/**
 * Bo's Swiggy tools: every tool on the user's open Swiggy MCP servers, each
 * wrapped with lib/bo/policy.ts, plus the SDK `toolApproval` callback that
 * enforces it.
 *
 * HOW AN ORDER IS PROTECTED (end to end):
 *   1. The model calls place_food_order / checkout / book_table / create_cart.
 *   2. toolApproval answers "user-approval". For a cart order it first reads
 *      the LIVE cart from Swiggy: the card shows Swiggy's own bill text, and a
 *      fingerprint of it is stored on the task (approval_requested event).
 *   3. The SDK signs the request with BO_APPROVAL_SECRET (HMAC). The client
 *      can only answer it; a forged, edited or unsigned approval is rejected
 *      by the SDK before execute ever runs (proved in the Phase 2 prototype).
 *   4. On the user's tap the next request carries the signed approval;
 *      execute re-reads the cart and refuses with cart_changed unless it
 *      still matches the fingerprint the user saw.
 * Without BO_APPROVAL_SECRET nothing that needs approval can run at all.
 *
 * Swiggy payloads are returned to the model but never stored: events keep
 * the tool name and an outcome, nothing from the response. Big ones are
 * compacted first (lib/bo/trim.ts).
 *
 * WHICH TOOLS A STEP SEES (activeToolNames): all 40 definitions are ~62k
 * characters, re-sent on every step. A step sees only each service's way in
 * (ENTRY) until Bo has used a service; from then on, that service's full set
 * plus the other services' way in, so it can still switch.
 */

import { jsonSchema, tool, type ToolApprovalStatus } from "ai";
import type { OpenServer } from "@/lib/mcp/client";
import { toolAllowed } from "@/lib/mcp/client";
import { sanitizeToolSchema } from "@/lib/mcp/schema";
import { decide, PLACES_ORDER, type ToolDecision } from "@/lib/bo/policy";
import { bookingSummary, cartBill, cartFingerprint, cartJson, cartLooksEmpty, cartSummary, resultText, type CartBill } from "@/lib/bo/approval";
import { addTaskEvent, findApprovalRequest, logId, updateTask, type TaskMode } from "@/lib/bo/tasks";
import { compactToolResult } from "@/lib/bo/trim";

/** The cart each order tool places, per Swiggy service. */
const CART_TOOL: Record<string, string> = { food: "get_food_cart", im: "get_cart" };
const MODE_FOR: Record<string, TaskMode> = { food: "order", im: "grocery", dineout: "dine_in" };
/** Each service's way in: what a step sees for a service Bo has not used yet. */
const ENTRY: Record<string, Set<string>> = {
  food: new Set(["get_addresses", "search_restaurants", "search_menu", "get_food_orders"]),
  im: new Set(["get_addresses", "search_products", "your_go_to_items"]),
  dineout: new Set(["search_restaurants_dineout"]),
};

interface ToolMeta {
  service: string;
  bare: string;
  decision: ToolDecision;
  open: OpenServer;
}

/** Shape of the approval reason the Approval card reads (JSON in requestReason). */
export interface ApprovalReason {
  action: string;
  service: string;
  /** Fallback text, used only when there is no structured bill. */
  summary: string;
  bill?: CartBill;
}

export interface BoToolContext {
  userId: string;
  taskId: string;
  /** null = approvals cannot be signed, so approval tools are denied. */
  approvalSecret: string | null;
}

function errorResult(err: unknown) {
  const msg = err instanceof Error ? err.message.slice(0, 200) : "tool_error";
  // Same mapping as /api/agent: 401/419/-32001 = reconnect, 429/-32000 = busy.
  const auth = /401|419|-32001|unauth|expired|invalid_token|revoked/i.test(msg);
  const busy = /429|-32000|too many requests|rate.?limit/i.test(msg);
  return { error: auth ? "swiggy_reconnect_required" : busy ? "rate_limited" : "tool_error", message: msg };
}

/** The live cart. Food's get_food_cart REQUIRES the delivery addressId (it
 *  prices delivery from it) — the same one the order tool was called with;
 *  Instamart's get_cart takes no arguments. */
async function readCart(meta: ToolMeta, orderArgs: Record<string, unknown>): Promise<{ text: string; bill: CartBill | null }> {
  const name = CART_TOOL[meta.service];
  const args = meta.service === "food" && typeof orderArgs.addressId === "string" ? { addressId: orderArgs.addressId } : {};
  const r = await meta.open.client.callTool({ name, arguments: args });
  const text = resultText(r);
  return { text, bill: cartBill(cartJson(r, text)) };
}

export async function buildBoTools(open: OpenServer[], ctx: BoToolContext) {
  const meta = new Map<string, ToolMeta>();
  // The SDK's tool union does not survive a Record<> well; cast at the boundary
  // as /api/agent does.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  for (const o of open) {
    const list = await o.client.listTools();
    for (const t of list.tools) {
      if (!toolAllowed(o.server, t.name)) continue;
      const decision = decide(o.serviceKey, t.name, t.annotations?.readOnlyHint === true);
      // Denied tools are not offered at all; the model cannot ask for them.
      if (decision.kind === "deny") continue;
      const name = `${o.namespace}__${t.name}`;
      const m: ToolMeta = { service: o.serviceKey, bare: t.name, decision, open: o };
      meta.set(name, m);

      tools[name] = tool({
        description: `[${o.serviceKey}] ${t.description ?? ""}`.slice(0, 1024),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inputSchema: jsonSchema(sanitizeToolSchema(t.inputSchema) as any),
        execute: async (rawArgs: unknown, { toolCallId }: { toolCallId: string }) => {
          const args = (rawArgs ?? {}) as Record<string, unknown>;
          const key = `${m.service}.${m.bare}`;

          if (m.decision.kind === "approve") {
            // Reaching execute means the SDK verified a signed user approval.
            if (PLACES_ORDER.has(key)) {
              const approved = (await findApprovalRequest(ctx.userId, ctx.taskId, toolCallId))?.fingerprint;
              if (!approved) return { aborted: true, reason: "not_approved" };
              let now: string;
              try {
                const cart = await readCart(m, args);
                now = cartFingerprint(cart.text, cart.bill);
              } catch (err) {
                return errorResult(err);
              }
              if (now !== approved) {
                await addTaskEvent(ctx.userId, ctx.taskId, "error", { tool: key, summary: "cart_changed" });
                return {
                  aborted: true,
                  reason: "cart_changed",
                  note: "The cart changed after the user approved it. Nothing was ordered. Show the new cart and ask again.",
                };
              }
            }
            await addTaskEvent(ctx.userId, ctx.taskId, "approval_granted", { tool: key, data: { toolCallId } });
            await updateTask(ctx.userId, ctx.taskId, { status: "executing" }).catch(() => {});
          }

          try {
            const r = await m.open.client.callTool({ name: m.bare, arguments: args });
            const text = resultText(r);
            const failed = (r as { isError?: boolean }).isError === true;
            await addTaskEvent(ctx.userId, ctx.taskId, "tool_result", { tool: key, summary: failed ? "error" : "ok" });
            if (!failed && (PLACES_ORDER.has(key) || key === "dineout.book_table")) {
              const status = /PENDING_PAYMENT/.test(text) ? "awaiting_payment" : "tracking";
              await updateTask(ctx.userId, ctx.taskId, { status }).catch(() => {});
            }
            if (!failed && m.bare === "confirm_order") {
              await updateTask(ctx.userId, ctx.taskId, { status: "tracking" }).catch(() => {});
            }
            return compactToolResult(r);
          } catch (err) {
            await addTaskEvent(ctx.userId, ctx.taskId, "tool_result", { tool: key, summary: "error" });
            return errorResult(err);
          }
        },
      });
    }
  }

  const toolApproval = async ({
    toolCall,
  }: {
    toolCall: { toolName: string; toolCallId: string; input: unknown };
  }): Promise<ToolApprovalStatus> => {
    const m = meta.get(toolCall.toolName);
    if (!m) return { type: "denied", reason: "Unknown tool." };
    if (m.decision.kind === "run") return undefined;
    if (m.decision.kind === "deny") return { type: "denied", reason: m.decision.reason };

    if (!ctx.approvalSecret) {
      return { type: "denied", reason: "Approvals are switched off right now, so Bo cannot order or book." };
    }

    const key = `${m.service}.${m.bare}`;
    const args = (toolCall.input ?? {}) as Record<string, unknown>;

    // The SDK calls this again on the turn that carries the user's answer.
    // The request (and the cart fingerprint the user saw) is recorded once;
    // a re-read here would replace it with the cart as it is NOW and defeat
    // the cart_changed check in execute.
    try {
      if (await findApprovalRequest(ctx.userId, ctx.taskId, toolCall.toolCallId)) return { type: "user-approval" };
    } catch {
      return { type: "denied", reason: "Could not check this approval. Try again." };
    }

    let summary = "";
    let bill: CartBill | null = null;
    let fingerprint: string | null = null;

    if (PLACES_ORDER.has(key)) {
      let text: string;
      try {
        ({ text, bill } = await readCart(m, args));
      } catch (err) {
        console.error(`bo[${logId(ctx.userId)}] cart read for approval failed:`, err instanceof Error ? err.message.slice(0, 200) : err);
        return { type: "denied", reason: "Could not read the Swiggy cart to show it to the user. Try again." };
      }
      if (cartLooksEmpty(text, bill)) return { type: "denied", reason: "The Swiggy cart is empty. Add items first." };
      summary = bill ? "" : cartSummary(text);
      // Never ask for approval of a bill the user cannot see.
      if (!bill && !/₹\s?\d/.test(summary)) return { type: "denied", reason: "Could not read Swiggy's bill to show it to the user. Try again." };
      fingerprint = cartFingerprint(text, bill);
    } else if (key === "dineout.book_table") {
      summary = bookingSummary(args);
    }

    await addTaskEvent(ctx.userId, ctx.taskId, "approval_requested", {
      tool: key,
      summary: m.decision.action,
      data: { toolCallId: toolCall.toolCallId, ...(fingerprint ? { fingerprint } : {}) },
    });
    await updateTask(ctx.userId, ctx.taskId, {
      status: "awaiting_approval",
      ...(MODE_FOR[m.service] ? { mode: MODE_FOR[m.service] } : {}),
    }).catch(() => {});

    const reason: ApprovalReason = { action: m.decision.action, service: m.service, summary, ...(bill ? { bill } : {}) };
    return { type: "user-approval", reason: JSON.stringify(reason) };
  };

  /** The Swiggy service a tool name belongs to ("food" / "im" / "dineout"). */
  const serviceOf = (toolName: string): string | null => meta.get(toolName)?.service ?? null;

  /** The tools a step sees, given the service Bo is working in (null = none yet). */
  const activeToolNames = (focus: string | null): string[] => {
    const names: string[] = [];
    const sharedSeen = new Set<string>();
    for (const [name, m] of meta) {
      if (m.service === focus) {
        names.push(name);
        sharedSeen.add(m.bare);
      }
    }
    for (const [name, m] of meta) {
      if (m.service === focus || !ENTRY[m.service]?.has(m.bare)) continue;
      // get_addresses is on both Food and Instamart: one copy is enough.
      if (sharedSeen.has(m.bare)) continue;
      sharedSeen.add(m.bare);
      names.push(name);
    }
    return names;
  };

  return { tools, toolApproval, count: meta.size, serviceOf, activeToolNames };
}
