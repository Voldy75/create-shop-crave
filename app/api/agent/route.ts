import { streamText, tool, jsonSchema } from "ai";
import { requireUser, denyIfRestricted } from "@/lib/auth-guard";
import { checkAndIncrementUsage } from "@/lib/rate-limit";
import { getModel, getServerModel, type Provider } from "@/lib/providers";
import { activeProviders } from "@/lib/mcp/registry";
import { connectProvider, closeAll, toolAllowed, type OpenServer } from "@/lib/mcp/client";
import { callbackUrlFor } from "@/lib/mcp/oauth";
import { ensureFreshConnection } from "@/lib/mcp/connections";
import { sanitizeToolSchema } from "@/lib/mcp/schema";

export const maxDuration = 60;

/**
 * Swiggy-aware chat agent. Connects to the user's three Swiggy MCP servers
 * (Food, Instamart, DineOut) via OAuth-stored bearer token, exposes all
 * 35 tools to the model with name prefixing for clarity, streams the
 * response back via the AI SDK data-stream protocol so the existing
 * useChat hook can consume it.
 *
 * Guardrails:
 *   - Destructive tools (place_food_order, checkout, book_table,
 *     cancel_booking) return {requiresConfirmation: true, ...} on the FIRST
 *     call. The model is instructed to surface the proposed action to the
 *     user and only re-invoke with `_confirmed: true` after explicit user yes.
 *   - place_food_order: defensive ₹1000 cap check (Swiggy's Food cap for
 *     Builders Club orders; the docs set no cap on Instamart or Dineout).
 *   - Payments follow Swiggy's HEADLESS flow (docs: "Pay with UPI end-to-end"
 *     → Non-UI clients): we cannot render their payment widgets, so the model
 *     lists get_payment_options as text, shares the UPI bridgeUrl, and checks
 *     status once per user turn. maxDuration is 60s and check_payment_status
 *     is a ~19s long-poll, so the poll loop is NOT run inside one request.
 *
 * Re-checked against https://mcp.swiggy.com/builders/docs/ on 2026-10-24:
 * endpoints (/food, /im, /dineout), OAuth 2.1 + PKCE + DCR, refresh grant,
 * scopes, and the production redirect allowlist (check-redirect-uri reports
 * our callback as whitelisted).
 */

const DESTRUCTIVE: Record<string, string> = {
  place_food_order: "Place a Swiggy food delivery order",
  checkout: "Place an Instamart grocery order",
  book_table: "Confirm a Dineout table reservation",
  cancel_booking: "Cancel a Dineout table reservation",
};

/**
 * Swiggy's Food cart cap for Builders Club orders (docs: Changelog → v1.0
 * known limitations, "Food cart cap ₹1000 for Builders Club origin orders").
 * Food only — Instamart and Dineout carry no such cap in the docs.
 */
const FOOD_CART_CAP = 1000;

// Tools we'll never expose — administrative or noisy.
const SKIP_TOOLS = new Set(["report_error"]);

const SYSTEM_PROMPT = `You are the Crave & Create concierge. The user has connected their Swiggy account, giving you access to three sets of tools:

- Tools prefixed with "swiggy_food__" → Swiggy Food (cooked-meal delivery)
- Tools prefixed with "swiggy_im__" → Swiggy Instamart (groceries)
- Tools prefixed with "swiggy_dineout__" → Swiggy DineOut (table reservations)

Tool names are always "<provider>_<service>__<tool>". Use the exact name as given
to you — never guess a prefix.

Use them when the user wants to order, shop, or book a table. Otherwise reply conversationally.

Hard rules:
1. Always start food/grocery flows with get_addresses (the correct prefixed variant) to pick a delivery address.
2. Before any destructive action (swiggy_food__place_food_order, swiggy_im__checkout, swiggy_dineout__book_table):
   - On the FIRST invocation the tool will return {requiresConfirmation: true, summary}.
   - You MUST surface the summary clearly to the user and ask them yes/no.
   - Only after the user explicitly confirms in their next message, call the SAME tool again with the same arguments plus _confirmed: true.
3. Swiggy Food orders through this app are capped at ₹1000 per cart. Instamart and Dineout have no such cap.
4. Paying (Food, Instamart, paid Dineout deals) — you cannot show Swiggy's payment widgets, so use the text flow:
   a. Call the server's get_payment_options and list the methods it returns in plain text (UPI apps / scan-to-pay, Swiggy Money when offered, Cash when offered). Never offer a method it did not return.
   b. After the user has confirmed the order (rule 2), place it with the method they picked: paymentMethod "Cash", or paymentMethod "UPI" with the intentApp id they chose (or generateUPIQR: true for scan-to-pay).
   c. For UPI the response carries data.bridgeUrl — give the user that link ("open this to pay in your UPI app or scan the QR"), and ask them to tell you when they have paid. Do not invent a link.
   d. When they say they paid, call check_payment_status ONCE with the ids from the order response (Food also needs addressId, lat, lng). On success, call confirm_order only if the order is not already confirmed. On failed: offer to try again with get_payment_options. On cart_changed: ask them to review the cart. On cancelled or refund-initiated: tell them, do not retry.
   e. Never call a place-order tool twice for the same cart. If a place-order call fails or times out, check get_food_orders / get_orders / get_booking_status first to see whether it went through.
5. Never invent restaurant IDs, item IDs, slots, or addresses. Always discover them via the relevant search tool.
6. After placing an order, you can track it with the relevant track_* / get_*_orders / get_booking_status tool — poll no faster than every 10 seconds.
7. If a tool returns swiggy_reconnect_required, tell the user their Swiggy connection needs renewing in Settings → Connections. If it returns rate_limited, tell them Swiggy is busy and to try again in a minute.
8. When you show results, carts or confirmations, say which Swiggy service they come from (Swiggy for food, Instamart for groceries, Dineout for tables).

If you cannot do something with the available tools, say so plainly. Don't fabricate.`;

interface AgentRequest {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  provider?: Provider;
  apiKey?: string;
}

export async function POST(req: Request) {
  let body: AgentRequest;
  try {
    body = (await req.json()) as AgentRequest;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!Array.isArray(body.messages)) {
    return Response.json({ error: "missing_messages" }, { status: 400 });
  }

  const guard = await requireUser();
  if (guard instanceof Response) return guard;
  const { user, profile } = guard;

  // Must precede the BYOK branch below: BYOK skips quota entirely, so without
  // this a restricted user just supplies their own key. This route can place
  // real Swiggy orders, so it is the one that matters most.
  const restricted = denyIfRestricted(profile);
  if (restricted) return restricted;

  // Which providers are switched on, configured, AND connected by this user?
  // activeProviders() already filters out anything enabled-but-unconfigured.
  const providers = await activeProviders();
  const connected: { providerId: string; accessToken: string }[] = [];
  let sawExpired = false;

  for (const p of providers) {
    // Transparently refreshes when the provider issued a refresh token;
    // returns null when the user genuinely has to reconnect.
    const result = await ensureFreshConnection(user.id, p, callbackUrlFor(req, p.id));
    if (result.status === "none") continue;
    if (result.status === "expired") {
      sawExpired = true;
      continue;
    }
    connected.push({ providerId: p.id, accessToken: result.connection.accessToken });
  }

  if (connected.length === 0) {
    return Response.json(
      {
        error: "swiggy_reconnect_required",
        message: sawExpired
          ? "Your Swiggy session expired and could not be renewed. Reconnect to keep ordering."
          : "Connect your Swiggy account in Settings → Connections first.",
      },
      { status: 412 },
    );
  }

  // Chat quota (system uses the user's daily AI quota; BYOK bypasses).
  let model;
  let usedBYOK = false;
  if (body.apiKey && body.provider) {
    usedBYOK = true;
    model = getModel(body.provider, body.apiKey);
  } else {
    const quota = await checkAndIncrementUsage(user.id);
    if (!quota.allowed) {
      return Response.json(
        { error: "rate_limit_exceeded", needsKey: true, message: "Daily AI limit reached." },
        { status: 429 },
      );
    }
    model = getServerModel();
  }

  // Open every enabled endpoint across every connected provider.
  const open: OpenServer[] = (
    await Promise.all(connected.map((c) => connectProvider(c.providerId, c.accessToken)))
  ).flat();

  if (open.length === 0) {
    return Response.json(
      { error: "swiggy_connect_failed", message: "Couldn't reach the provider's MCP servers. Try again in a moment." },
      { status: 502 },
    );
  }

  // Discover and register tools, namespaced per service.
  // The CoreTool union has both with- and without-execute variants, which
  // collapses badly when stored in a Record<>. Cast at the boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aiTools: Record<string, any> = {};
  try {
    for (const { client, serviceKey, namespace, server } of open) {
      const list = await client.listTools();
      for (const t of list.tools) {
        if (SKIP_TOOLS.has(t.name)) continue;
        // Per-server allowlist from the registry; NULL/empty = expose all.
        if (!toolAllowed(server, t.name)) continue;
        const namespaced = `${namespace}__${t.name}`;
        // NOTE: DESTRUCTIVE is keyed by bare tool name and its ₹1000 cap is
        // Swiggy-specific. That is fine while Swiggy is the only provider with
        // a real endpoint. When a second one lands, this metadata belongs on
        // mcp_provider_servers (a `destructive_tools` column) rather than in
        // a module constant — deliberately not built for hypothetical
        // providers that may never exist.
        const isDestructive = Boolean(DESTRUCTIVE[t.name]);
        aiTools[namespaced] = tool({
          description: `[${serviceKey}] ${t.description ?? ""}`.slice(0, 1024),
          // Swiggy's raw schemas use JSON Schema features Gemini rejects
          // (type arrays, a top-level anyOf) and ONE bad tool fails the whole
          // request — see lib/mcp/schema.ts. Swiggy validates real arguments.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          parameters: jsonSchema(sanitizeToolSchema(t.inputSchema) as any),
          execute: async (rawArgs: unknown) => {
            const args = (rawArgs ?? {}) as Record<string, unknown>;
            const confirmed = args._confirmed === true;
            // Strip our internal flag before forwarding to Swiggy.
            const cleanArgs = { ...args };
            delete cleanArgs._confirmed;

            // Confirmation gate: bounce the first call back to the model with a
            // structured "requiresConfirmation" payload. The model then asks
            // the user, and on yes re-invokes with _confirmed: true.
            if (isDestructive && !confirmed) {
              return {
                requiresConfirmation: true,
                action: t.name,
                summary: `${DESTRUCTIVE[t.name]} — surface the relevant details (items, total, address, slot) to the user and ask them to confirm before I proceed.`,
                proposedArgs: cleanArgs,
                limits: t.name === "place_food_order"
                  ? `Swiggy Food orders from this app are capped at ₹${FOOD_CART_CAP}.`
                  : undefined,
              };
            }

            // ₹1000 defensive cap: bail out cheaply if model has somehow built a
            // huge cart and is about to place. The model should already have
            // shown total to the user, but this is a belt-and-suspenders.
            if (t.name === "place_food_order" && confirmed) {
              try {
                const cartResult = await client.callTool({ name: "get_food_cart", arguments: {} });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const cart = cartResult.structuredContent as any;
                const total = cart?.data?.total ?? cart?.data?.bill?.totalToPay ?? 0;
                if (typeof total === "number" && total > FOOD_CART_CAP) {
                  return {
                    aborted: true,
                    reason: `exceeds_₹${FOOD_CART_CAP}_cap`,
                    total,
                    note: `Swiggy caps Food orders from this app at ₹${FOOD_CART_CAP}. Ask the user to remove items.`,
                  };
                }
              } catch {
                // Cart fetch failed — proceed; downstream call will surface a real error if any.
              }
            }

            try {
              const result = await client.callTool({ name: t.name, arguments: cleanArgs });
              return result.structuredContent ?? result.content ?? result;
            } catch (err) {
              const msg = err instanceof Error ? err.message.slice(0, 200) : "tool_error";
              // Swiggy signals auth failure as HTTP 401 or JSON-RPC -32001, and a
              // revoked session as 419 (docs: Authenticate → Troubleshooting).
              // Rate limiting is 429 / JSON-RPC -32000 (docs: Ship to production).
              const looksAuth = /401|419|-32001|unauth|expired|invalid_token|revoked/i.test(msg);
              const looksRateLimited = /429|-32000|too many requests|rate.?limit/i.test(msg);
              return {
                error: looksAuth ? "swiggy_reconnect_required" : looksRateLimited ? "rate_limited" : "tool_error",
                message: msg,
              };
            }
          },
        });
      }
    }
  } catch (err) {
    await closeAll(open);
    console.error("agent: tool discovery failed:", err instanceof Error ? err.message.slice(0, 300) : err);
    return Response.json(
      { error: "tool_discovery_failed", message: err instanceof Error ? err.message.slice(0, 200) : "unknown" },
      { status: 502 },
    );
  }

  // Build the streamed response, closing MCP clients in onFinish so in-flight
  // tool calls aren't truncated.
  let result;
  try {
    result = await streamText({
      model,
      system: SYSTEM_PROMPT,
      messages: body.messages.filter((m) => m.role === "user" || m.role === "assistant"),
      tools: aiTools,
      toolChoice: "auto",
      maxToolRoundtrips: 6, // allow chains like address → search → menu → cart → place
      onFinish: async () => {
        await closeAll(open);
      },
    });
  } catch (err) {
    await closeAll(open);
    // Logged: this branch used to return 500 silently, which hid the Gemini
    // schema rejection behind an empty log line.
    console.error("agent: model call failed:", err instanceof Error ? err.message.slice(0, 300) : err);
    return Response.json(
      { error: "agent_failed", message: "Bo couldn't reach the AI model just now. Please try again in a moment." },
      { status: 500 },
    );
  }

  const response = result.toDataStreamResponse();
  if (usedBYOK) response.headers.set("X-Usage-BYOK", "true");
  response.headers.set("X-Swiggy-Tools", String(Object.keys(aiTools).length));
  return response;
}
