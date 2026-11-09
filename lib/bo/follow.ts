/**
 * Phase 3 — Bo's follow-through after a UPI order: watch the payment and
 * finalise the order, even if the user closes the chat.
 *
 * Swiggy's contract (tool docs for check_payment_status / confirm_order):
 * the HOST app polls the payment "on a fixed cadence" — never a tight loop —
 * and calls confirm_order on the first SUCCESS, and also at the 5-minute
 * wall-clock cap while still pending (Swiggy then marks it failed and
 * recovers a late success itself). Never confirm on FAILED or
 * REFUND-INITIATED. confirm_order is idempotent.
 *
 * DURABILITY. The ids Swiggy returned on PENDING_PAYMENT are saved on the
 * task (agent_tasks.plan.payment), so any request can pick the watch up:
 *   - /api/bo starts it after the turn that placed the order (next/server
 *     `after`, so it keeps going when the tab closes), and
 *   - GET /api/bo/tasks/[id] — the chat's status poll — resumes it if a
 *     run ran out of time.
 * A short lease in the plan (updatePlanIfUnchanged) keeps it to one watcher
 * at a time. Each run stops before its function's time is up.
 *
 * The outcome reaches the user three ways: the task status (the chat's
 * status strip polls it), a push notification on the channels they turned
 * on, and a line in Bo's instructions on the next turn.
 */

import type { OpenServer } from "@/lib/mcp/client";
import { connectProvider, closeAll } from "@/lib/mcp/client";
import { activeProviders } from "@/lib/mcp/registry";
import { ensureFreshConnection } from "@/lib/mcp/connections";
import { resultText } from "@/lib/bo/approval";
import { addTaskEvent, getTask, logId, updatePlanIfUnchanged } from "@/lib/bo/tasks";
import { notifyUser } from "@/lib/bo/notify";

const CADENCE_MS = 8_000;
const CAP_MS = 5 * 60_000;
const LEASE_MS = 30_000;
const MAX_ERRORS = 3;

export type PaymentResult = "success" | "failed" | "refund" | "timeout";

/** Saved on the task when Swiggy answers PENDING_PAYMENT. */
export interface PaymentWatch {
  service: string;
  orderId: string;
  paasId?: string;
  transactionId?: string;
  addressId?: string;
  cartId?: string;
  lat?: number;
  lng?: number;
  /** Swiggy's To Pay, for the notification. */
  amount?: string;
  /** Swiggy's own poll gap and window, from the place-order response. */
  pollMs?: number;
  maxMs?: number;
  startedAt: string;
  leaseUntil?: string;
  result?: PaymentResult;
  endedAt?: string;
}

const ID_KEYS = ["orderId", "paasId", "transactionId", "addressId", "cartId"] as const;

/** First value of `key` anywhere in a JSON tree. */
function find(v: unknown, key: string, depth = 0): unknown {
  if (!v || typeof v !== "object" || depth > 6) return undefined;
  if (!Array.isArray(v) && key in (v as object)) return (v as Record<string, unknown>)[key];
  for (const x of Object.values(v as object)) {
    const r = find(x, key, depth + 1);
    if (r !== undefined) return r;
  }
  return undefined;
}

function textJson(text: string): unknown {
  const at = text.indexOf("{");
  if (at < 0) return null;
  try {
    return JSON.parse(text.slice(at));
  } catch {
    return null;
  }
}

/**
 * The payment to watch, from a place-order / checkout / book_table result —
 * or null when it is not a pending UPI payment (cash, a failure, a missing
 * transaction id: then there is nothing to watch, and Bo handles it in chat).
 */
export function pendingPayment(service: string, result: unknown, amount?: string): PaymentWatch | null {
  const text = resultText(result);
  const sc = (result as { structuredContent?: unknown })?.structuredContent;
  if (!/PENDING_PAYMENT/.test(text + JSON.stringify(sc ?? ""))) return null;
  const trees = [sc, textJson(text)];
  const pick = (k: string) => {
    for (const t of trees) {
      const v = find(t, k);
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number") return String(v);
    }
    // Markdown answers: "orderId: 123" / "Order ID: 123".
    const m = text.match(new RegExp(`${k}["'\\s:=]+([A-Za-z0-9_-]{4,})`, "i"));
    return m?.[1];
  };
  const num = (k: string) => {
    for (const t of trees) {
      const v = Number(find(t, k));
      if (Number.isFinite(v) && v !== 0) return v;
    }
    return undefined;
  };
  const ids = Object.fromEntries(ID_KEYS.map((k) => [k, pick(k)]).filter(([, v]) => v)) as Partial<Record<(typeof ID_KEYS)[number], string>>;
  if (!ids.orderId) return null;
  // check_payment_status needs the payment transaction id.
  if (!ids.paasId) return null;
  const total = amount ?? (num("cartTotal") ?? num("totalAmount"));
  const clamp = (v: number | undefined, lo: number, hi: number) => (v ? Math.min(hi, Math.max(lo, v)) : undefined);
  return {
    service,
    orderId: ids.orderId,
    ...ids,
    lat: num("lat") ?? num("latitude"),
    lng: num("lng") ?? num("longitude"),
    ...(total ? { amount: typeof total === "number" ? `₹${total}` : total } : {}),
    pollMs: clamp(num("pollingIntervalInMs"), CADENCE_MS, 60_000),
    // Never under the 5-minute cap: Swiggy's short value closed a real order
    // after a minute, far too soon to open a UPI app or scan a QR.
    maxMs: clamp(num("maxTimeToPollForInMs"), CAP_MS, 15 * 60_000),
    startedAt: new Date().toISOString(),
  };
}

/**
 * Swiggy's payment page for a pending UPI order: `bridgeUrl`, an opaque https
 * link that shows a QR and an "Open in your UPI app" button. It is the only
 * way the user can pay, so it goes on the Approval card. Read from the data,
 * not the message: the scan-QR flow leaves it out of the message.
 */
export function paymentLink(result: unknown): string | null {
  const text = resultText(result);
  for (const tree of [(result as { structuredContent?: unknown })?.structuredContent, textJson(text)]) {
    const v = find(tree, "bridgeUrl");
    if (typeof v === "string" && /^https:\/\//i.test(v.trim())) return v.trim();
  }
  return text.match(/bridgeUrl["'*\s:=]+(https:\/\/[^\s"'<>)]+)/i)?.[1] ?? null;
}

/**
 * Key names, status and the non-identifying payment fields, never ids, links
 * or amounts: enough to debug Swiggy's shape from the task log.
 */
export function paymentShape(result: unknown): Record<string, unknown> {
  const text = resultText(result);
  const tree = (result as { structuredContent?: unknown })?.structuredContent ?? textJson(text);
  const data = (find(tree, "data") ?? tree) as Record<string, unknown> | null;
  const status = find(tree, "status");
  const result_ = find(tree, "result");
  const presentation = find(tree, "paymentPresentation");
  const intent = find(tree, "upiIntentUrl");
  const bridge = find(tree, "bridgeUrl");
  const number = (k: string) => (typeof find(tree, k) === "number" ? { [k]: find(tree, k) } : {});
  return {
    keys: data && typeof data === "object" ? Object.keys(data).slice(0, 30) : [],
    structured: !!(result as { structuredContent?: unknown })?.structuredContent,
    ...(typeof status === "string" ? { status: status.slice(0, 40) } : {}),
    ...(typeof find(tree, "terminal") === "boolean" ? { terminal: find(tree, "terminal") } : {}),
    ...(typeof result_ === "string" ? { result: result_.slice(0, 40) } : {}),
    ...(typeof find(tree, "isQrFlow") === "boolean" ? { isQrFlow: find(tree, "isQrFlow") } : {}),
    ...number("pollingIntervalInMs"),
    ...number("maxTimeToPollForInMs"),
    ...(typeof presentation === "string" ? { paymentPresentation: presentation.slice(0, 40) } : presentation && typeof presentation === "object" ? { paymentPresentation: Object.keys(presentation).slice(0, 12) } : {}),
    ...(typeof intent === "string" ? { upiIntent: { scheme: intent.match(/^[a-z][a-z0-9+.-]*(?=:)/i)?.[0] ?? null, length: intent.length } } : {}),
    ...(typeof bridge === "string" ? { bridgePath: bridge.match(/^https:\/\/[^/]+\/([^/?#]{0,24})/i)?.[1] ?? null } : {}),
  };
}

function classify(v: string): PaymentResult | "pending" {
  if (/REFUND/i.test(v)) return "refund";
  if (/^(SUCCESS|SUCCESSFUL|PAID|COMPLETED|CHARGED)$/i.test(v)) return "success";
  if (/^(FAIL(ED|URE)?|CANCELL?ED|CART[_-]CHANGED)$/i.test(v)) return "failed";
  return "pending";
}

/**
 * The payment status from a check_payment_status result. Read from the
 * structured status field — Swiggy's text also carries instructions that
 * mention SUCCESS and FAILED, and confirming a still-pending order makes
 * Swiggy mark it failed. Anything unclear counts as pending; the 5-minute
 * cap then closes it the way Swiggy prescribes.
 */
export function paymentStatusOf(result: unknown): PaymentResult | "pending" {
  const text = resultText(result);
  for (const tree of [(result as { structuredContent?: unknown })?.structuredContent, textJson(text)]) {
    // Swiggy's terminal flags outrank the status word, which has no fixed list.
    if (find(tree, "isTerminalSuccess") === true) return "success";
    if (find(tree, "isTerminalFailure") === true) {
      const s = find(tree, "status");
      return typeof s === "string" && /REFUND/i.test(s) ? "refund" : "failed";
    }
    for (const key of ["paymentStatus", "status", "state"]) {
      const v = find(tree, key);
      if (typeof v === "string" && v.trim()) return classify(v.trim());
    }
  }
  const m = text.match(/(?:payment\s*)?status["'*\s]*[:=]\s*["'*]*([A-Za-z_-]+)/i);
  return m ? classify(m[1].replace(/[-\s]/g, "_")) : "pending";
}

function checkArgs(w: PaymentWatch): Record<string, unknown> {
  const a: Record<string, unknown> = { paasId: w.paasId, orderId: w.orderId };
  if (w.service === "food") Object.assign(a, { addressId: w.addressId, cartId: w.cartId, lat: w.lat, lng: w.lng });
  return Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined));
}

function confirmArgs(w: PaymentWatch): Record<string, unknown> {
  const a: Record<string, unknown> =
    w.service === "food"
      ? { orderId: w.orderId, addressId: w.addressId, cartId: w.cartId, lat: w.lat, lng: w.lng }
      : { orderId: w.orderId, paasId: w.paasId, transactionId: w.transactionId };
  return Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined));
}

/** What the watcher touches — swapped for fakes in the offline check. */
export interface WatchDeps {
  getTask: typeof getTask;
  updatePlanIfUnchanged: typeof updatePlanIfUnchanged;
  addTaskEvent: typeof addTaskEvent;
  notifyUser: typeof notifyUser;
  openSwiggy: (userId: string, callbackUrl: (providerId: string) => string) => Promise<OpenServer[]>;
  closeAll: typeof closeAll;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

async function openSwiggy(userId: string, callbackUrl: (providerId: string) => string): Promise<OpenServer[]> {
  for (const p of await activeProviders()) {
    const fresh = await ensureFreshConnection(userId, p, callbackUrl(p.id));
    if (fresh.status === "ok") return connectProvider(p.id, fresh.connection.accessToken);
  }
  return [];
}

const MESSAGES: Record<PaymentResult, { title: string; body: (w: PaymentWatch) => string; status: "tracking" | "planning" | "failed" }> = {
  success: {
    title: "Your Swiggy order is placed",
    body: (w) => `Payment received${w.amount ? ` (${w.amount})` : ""} and the order is confirmed. Ask Bo where it is anytime.`,
    status: "tracking",
  },
  failed: {
    title: "Your payment didn’t go through",
    body: () => "Nothing was ordered. Open Bo to pay another way.",
    status: "planning",
  },
  refund: {
    title: "Swiggy started a refund",
    body: () => "The order didn’t go through and your money is on its way back.",
    status: "failed",
  },
  timeout: {
    title: "Payment timed out",
    body: () => "Bo didn’t see your payment in time, so it closed the order. If you paid, check this order in the Swiggy app.",
    status: "failed",
  },
};

/**
 * Watch the task's pending payment until it ends or `deadline` (epoch ms).
 * Safe to call from anywhere, any number of times: it returns at once when
 * there is nothing to watch or another watcher holds the lease.
 */
function confirmedPlaced(result: unknown): boolean {
  for (const tree of [(result as { structuredContent?: unknown })?.structuredContent, textJson(resultText(result))]) {
    const v = find(tree, "result");
    if (typeof v === "string") return /^success$/i.test(v.trim());
  }
  return false;
}

export async function watchPayment(
  userId: string,
  taskId: string,
  deadline: number,
  callbackUrl: (providerId: string) => string,
  deps: Partial<WatchDeps> = {}
): Promise<void> {
  const d: WatchDeps = {
    getTask,
    updatePlanIfUnchanged,
    addTaskEvent,
    notifyUser,
    openSwiggy,
    closeAll,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: Date.now,
    ...deps,
  };
  const { sleep } = d;
  let open: OpenServer[] = [];
  let errors = 0;
  try {
    for (;;) {
      const task = await d.getTask(userId, taskId);
      const w = (task?.plan?.payment ?? null) as PaymentWatch | null;
      if (!task || !w || w.result) return;
      const now = d.now();
      if (w.leaseUntil && Date.parse(w.leaseUntil) > now && !open.length) return;
      if (now + CADENCE_MS > deadline) {
        // Out of time for this run: hand the watch to the next one.
        await d.updatePlanIfUnchanged(userId, taskId, task.updated_at, { ...task.plan, payment: { ...w, leaseUntil: undefined } });
        return;
      }
      const lease = { ...w, leaseUntil: new Date(now + LEASE_MS).toISOString() };
      if (!(await d.updatePlanIfUnchanged(userId, taskId, task.updated_at, { ...task.plan, payment: lease }))) return;

      if (!open.length) open = await d.openSwiggy(userId, callbackUrl);
      const server = open.find((o) => o.serviceKey === w.service);
      if (!server) {
        if (++errors >= MAX_ERRORS) return;
        await sleep(CADENCE_MS);
        continue;
      }

      const cadence = w.pollMs ?? CADENCE_MS;
      const expired = now - Date.parse(w.startedAt) >= (w.maxMs ?? CAP_MS);
      let result: PaymentResult | "pending";
      try {
        if (expired) {
          result = "timeout";
        } else {
          const r = await server.client.callTool({ name: "check_payment_status", arguments: checkArgs(w) });
          result = paymentStatusOf(r);
          await d.addTaskEvent(userId, taskId, "tool_result", { tool: `${w.service}.check_payment_status`, summary: result, data: paymentShape(r) });
        }
        // SUCCESS finalises; at the cap it tells Swiggy to close the pending order.
        if (result === "success" || result === "timeout") {
          const c = await server.client.callTool({ name: "confirm_order", arguments: confirmArgs(w) });
          const failed = (c as { isError?: boolean }).isError === true;
          await d.addTaskEvent(userId, taskId, "tool_result", { tool: `${w.service}.confirm_order`, summary: failed ? "error" : "ok", data: paymentShape(c) });
          if (failed && result === "success") throw new Error("confirm_order failed");
          // A late payment: at the cap Swiggy can still answer that it went through.
          if (result === "timeout" && !failed && confirmedPlaced(c)) result = "success";
        }
        errors = 0;
      } catch (err) {
        console.error(`bo[${logId(userId)}] payment watch step failed:`, err instanceof Error ? err.message.slice(0, 200) : err);
        if (++errors >= MAX_ERRORS) {
          const fresh = await d.getTask(userId, taskId);
          if (fresh) await d.updatePlanIfUnchanged(userId, taskId, fresh.updated_at, { ...fresh.plan, payment: { ...lease, leaseUntil: undefined } });
          return;
        }
        await sleep(CADENCE_MS);
        continue;
      }

      if (result === "pending") {
        await sleep(cadence);
        continue;
      }

      const fresh = await d.getTask(userId, taskId);
      if (!fresh) return;
      const m = MESSAGES[result];
      const ended: PaymentWatch = { ...lease, leaseUntil: undefined, result, endedAt: new Date().toISOString() };
      await d.updatePlanIfUnchanged(userId, taskId, fresh.updated_at, { ...fresh.plan, payment: ended }, m.status);
      await d.notifyUser(userId, taskId, { title: m.title, body: m.body(w) });
      return;
    }
  } catch (err) {
    console.error(`bo[${logId(userId)}] payment watch failed:`, err instanceof Error ? err.message.slice(0, 200) : err);
  } finally {
    if (open.length) await d.closeAll(open);
  }
}

/** One line for Bo's instructions on the next turn, or null. */
export function paymentLine(plan: Record<string, unknown> | undefined): string | null {
  const w = (plan?.payment ?? null) as PaymentWatch | null;
  if (!w) return null;
  const id = `order ${w.orderId}`;
  switch (w.result) {
    case "success":
      return `PAYMENT (checked by meshi): the UPI payment for ${id} succeeded and meshi already called confirm_order — the order IS placed. Do not call check_payment_status or confirm_order again.`;
    case "failed":
      return `PAYMENT (checked by meshi): the UPI payment for ${id} FAILED. Nothing was ordered; offer get_payment_options to pay another way. Do not call confirm_order.`;
    case "refund":
      return `PAYMENT (checked by meshi): Swiggy started a refund for ${id}. The order did not go through. Do not call confirm_order.`;
    case "timeout":
      return `PAYMENT (checked by meshi): the payment for ${id} timed out; meshi closed it with confirm_order. If the user says they paid, tell them to check the order in the Swiggy app, and do not order again until they have. Otherwise, if they still want it, start again from the cart.`;
    default:
      return `PAYMENT: meshi is watching the UPI payment for ${id} and will confirm the order by itself when it succeeds. Do not call check_payment_status or confirm_order; tell the user it updates on its own.`;
  }
}
