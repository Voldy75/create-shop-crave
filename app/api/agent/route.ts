import { streamText, tool, jsonSchema } from "ai";
import { createClient } from "@/lib/supabase/server";
import { checkAndIncrementUsage } from "@/lib/rate-limit";
import { getModel, getServerModel, type Provider } from "@/lib/providers";
import {
  connectAll,
  closeAll,
  getStoredToken,
  isExpired,
  type SwiggyService,
} from "@/lib/swiggy-mcp";

export const maxDuration = 60;

/**
 * Swiggy-aware chat agent. Connects to the user's three Swiggy MCP servers
 * (Food, Instamart, DineOut) via OAuth-stored bearer token, exposes all
 * 35 tools to the model with name prefixing for clarity, streams the
 * response back via the AI SDK data-stream protocol so the existing
 * useChat hook can consume it.
 *
 * Guardrails:
 *   - Destructive tools (place_food_order, checkout, book_table) return
 *     {requiresConfirmation: true, ...} on the FIRST call. The model is
 *     instructed to surface the proposed action to the user and only
 *     re-invoke with `_confirmed: true` after explicit user yes.
 *   - place_food_order / checkout: defensive ₹1000 cap check (Swiggy
 *     Builders Club v1 limit).
 *   - COD-only messaging baked into the system prompt.
 */

const DESTRUCTIVE: Record<string, string> = {
  place_food_order: "Place a Swiggy food delivery order",
  checkout: "Place an Instamart grocery order",
  book_table: "Confirm a DineOut table reservation",
};

// Tools we'll never expose — administrative or noisy.
const SKIP_TOOLS = new Set(["report_error"]);

const SYSTEM_PROMPT = `You are the Crave & Create concierge. The user has connected their Swiggy account, giving you access to three sets of tools:

- Tools prefixed with "food__" → Swiggy Food (cooked-meal delivery)
- Tools prefixed with "im__" → Swiggy Instamart (groceries)
- Tools prefixed with "dineout__" → Swiggy DineOut (table reservations)

Use them when the user wants to order, shop, or book. Otherwise reply conversationally.

Hard rules:
1. Always start food/grocery flows with get_addresses (the correct prefixed variant) to pick a delivery address.
2. Before any destructive action (food__place_food_order, im__checkout, dineout__book_table):
   - On the FIRST invocation the tool will return {requiresConfirmation: true, summary}.
   - You MUST surface the summary clearly to the user and ask them yes/no.
   - Only after the user explicitly confirms in their next message, call the SAME tool again with the same arguments plus _confirmed: true.
3. Swiggy MCP v1 limits: orders capped at ₹1000, COD only, no refresh tokens (the connection may expire — surface that gently if a tool call fails with 401-like behavior).
4. Never invent restaurant IDs, item IDs, or addresses. Always discover them via the relevant search tool.
5. After placing an order, you can track it with the relevant track_* / get_*_orders tool — poll no faster than every 10 seconds.

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

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Swiggy token gate.
  const token = await getStoredToken(user.id);
  if (!token || isExpired(token)) {
    return Response.json(
      {
        error: "swiggy_reconnect_required",
        message: token ? "Your Swiggy session expired (Swiggy MCP v1 has no refresh tokens). Reconnect to keep ordering." : "Connect your Swiggy account in Settings → Notifications first.",
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

  // Open MCP clients for all three services.
  const clients = await connectAll(token.accessToken);
  const openServices = Object.keys(clients) as SwiggyService[];
  if (openServices.length === 0) {
    return Response.json(
      { error: "swiggy_connect_failed", message: "Couldn't reach Swiggy MCP. Try again in a moment." },
      { status: 502 },
    );
  }

  // Discover and register tools, namespaced per service.
  // The CoreTool union has both with- and without-execute variants, which
  // collapses badly when stored in a Record<>. Cast at the boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aiTools: Record<string, any> = {};
  try {
    for (const service of openServices) {
      const client = clients[service];
      if (!client) continue;
      const list = await client.listTools();
      for (const t of list.tools) {
        if (SKIP_TOOLS.has(t.name)) continue;
        const namespaced = `${service}__${t.name}`;
        const isDestructive = Boolean(DESTRUCTIVE[t.name]);
        aiTools[namespaced] = tool({
          description: `[${service}] ${t.description ?? ""}`.slice(0, 1024),
          // Pass the MCP tool's raw JSON Schema directly via the AI SDK helper.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          parameters: jsonSchema((t.inputSchema ?? { type: "object" }) as any),
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
                limits: t.name === "place_food_order" || t.name === "checkout"
                  ? "Swiggy v1 Builders Club: ₹1000 cap, COD only."
                  : undefined,
              };
            }

            // ₹1000 defensive cap: bail out cheaply if model has somehow built a
            // huge cart and is about to place. The model should already have
            // shown total to the user, but this is a belt-and-suspenders.
            if ((t.name === "place_food_order" || t.name === "checkout") && confirmed) {
              try {
                const cartTool = t.name === "place_food_order" ? "get_food_cart" : "get_cart";
                const cartResult = await client.callTool({ name: cartTool, arguments: {} });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const cart = cartResult.structuredContent as any;
                const total = cart?.data?.total ?? cart?.data?.bill?.totalToPay ?? 0;
                if (typeof total === "number" && total > 1000) {
                  return {
                    aborted: true,
                    reason: "exceeds_₹1000_cap",
                    total,
                    note: "Swiggy v1 Builders Club caps orders at ₹1000. Ask the user to remove items.",
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
              // Treat anything that smells like 401/expired as reconnect_required so
              // the user can repair the channel.
              const looksAuth = /401|unauth|expired|invalid_token/i.test(msg);
              return {
                error: looksAuth ? "swiggy_reconnect_required" : "tool_error",
                message: msg,
              };
            }
          },
        });
      }
    }
  } catch (err) {
    await closeAll(clients);
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
        await closeAll(clients);
      },
    });
  } catch (err) {
    await closeAll(clients);
    return Response.json(
      { error: "agent_failed", message: err instanceof Error ? err.message.slice(0, 200) : "unknown" },
      { status: 500 },
    );
  }

  const response = result.toDataStreamResponse();
  if (usedBYOK) response.headers.set("X-Usage-BYOK", "true");
  response.headers.set("X-Swiggy-Tools", String(Object.keys(aiTools).length));
  return response;
}
