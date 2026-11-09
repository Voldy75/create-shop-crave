/**
 * Where a Bo task stands, read from the conversation itself — the tool calls,
 * the Approval card and Swiggy's answers that are already in the messages.
 * The status card (components/bo/TaskStatusCard.tsx) re-renders with the
 * chat. The one server input is the payment outcome: while the strip shows
 * Payment, lib/bo/use-task-follow.ts polls it and passes it in as `follow`.
 *
 * Stages per kind of task:
 *   order / grocery  Finding → Cart → Your OK → Payment → Placed
 *   dine_in          Finding → Slot → Your OK → Booked
 *   cook             Finding → Recipe
 * "Your OK" is the Approval card; nothing moves past it without the tap.
 */

import { parseApprovalReason } from "@/lib/bo/agent-client";
import type { TaskFollow } from "@/lib/bo/use-task-follow";

export type BoTaskKind = "order" | "grocery" | "dine_in" | "cook";
export type BoTaskTone = "working" | "you" | "done" | "warn";

export interface BoTaskStatus {
  kind: BoTaskKind;
  stages: string[];
  /** Index into stages. */
  current: number;
  /** One line: what is happening now. */
  label: string;
  /** Optional second line: the amount, or what the user should do. */
  detail?: string;
  /** working = Bo is on it; you = waiting on the user; done; warn = stopped. */
  tone: BoTaskTone;
}

interface ToolPart {
  type: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  approval?: { id: string; requestReason?: string; approved?: boolean };
}

interface Msg {
  role: string;
  parts?: ReadonlyArray<ToolPart>;
}

const STAGES: Record<BoTaskKind, string[]> = {
  order: ["Finding", "Cart", "Your OK", "Payment", "Placed"],
  grocery: ["Finding", "Cart", "Your OK", "Payment", "Placed"],
  dine_in: ["Finding", "Slot", "Your OK", "Booked"],
  cook: ["Finding", "Recipe"],
};

const KIND_FOR: Record<string, BoTaskKind> = { food: "order", im: "grocery", dineout: "dine_in", cook: "cook" };

const PLACE = new Set(["place_food_order", "checkout"]);
const CART = new Set(["update_food_cart", "update_cart", "get_food_cart", "get_cart", "apply_food_coupon"]);
const CLEAR = new Set(["flush_food_cart", "clear_cart"]);
const SLOT = new Set(["get_available_slots", "get_restaurant_details"]);
const TRACK = new Set(["track_food_order", "track_order", "get_food_delivery_status", "get_delivery_status"]);

function toolOf(p: ToolPart): { service: string; bare: string } | null {
  const full = p.type === "dynamic-tool" ? p.toolName ?? "" : p.type.startsWith("tool-") ? p.type.slice(5) : "";
  const m = full.match(/^(?:swiggy|meshi)_(\w+?)__(\w+)$/);
  return m ? { service: m[1], bare: m[2] } : null;
}

function outText(p: ToolPart): string {
  return typeof p.output === "string" ? p.output : JSON.stringify(p.output ?? "");
}

function failed(p: ToolPart): boolean {
  const o = p.output as { error?: unknown } | null | undefined;
  return p.state === "output-error" || !!(o && typeof o === "object" && o.error);
}

/** Is the task waiting on the user's UPI payment (so the server is watching it)? */
export function awaitingPayment(s: BoTaskStatus | null): boolean {
  return !!s && s.stages[s.current] === "Payment" && s.tone === "you";
}

/**
 * null until Bo has used a tool in this conversation (plain chat has no
 * task). `follow` is the server's payment outcome (lib/bo/follow.ts): it
 * moves a pending payment on without a new message.
 */
export function boTaskStatus(messages: ReadonlyArray<Msg>, follow?: TaskFollow | null): BoTaskStatus | null {
  const s = fromMessages(messages);
  const result = follow?.payment?.result;
  if (!s || !awaitingPayment(s) || !result || result === "pending") return s;
  const amount = follow?.payment?.amount ?? undefined;
  const stages = s.stages;
  const at = (stage: string) => Math.max(0, stages.indexOf(stage));
  switch (result) {
    case "success":
      return { ...s, current: at(s.kind === "dine_in" ? "Booked" : "Placed"), tone: "done", label: s.kind === "dine_in" ? "Booking confirmed" : "Order placed", detail: amount ? `${amount} paid · Bo can track it for you.` : "Paid · Bo can track it for you." };
    case "failed":
      return { ...s, tone: "warn", label: "The payment didn’t go through", detail: "Nothing was ordered. Tap Pay another way on the card." };
    case "refund":
      return { ...s, tone: "warn", label: "Swiggy started a refund", detail: "The order didn’t go through; your money is on its way back." };
    case "timeout":
      return { ...s, tone: "warn", label: "Payment timed out", detail: "Bo closed the order. If you paid, check it in the Swiggy app." };
  }
}

/** The key of the latest order waiting on (or past) a UPI payment, from its tool output. */
export function latestPaymentKey(messages: ReadonlyArray<Msg>): string | null {
  let key: string | null = null;
  for (const m of messages) {
    for (const p of m.parts ?? []) {
      const k = (p.output as { paymentKey?: unknown } | null | undefined)?.paymentKey;
      if (typeof k === "string") key = k;
    }
  }
  return key;
}

function fromMessages(messages: ReadonlyArray<Msg>): BoTaskStatus | null {
  let s: BoTaskStatus | null = null;
  let amount: string | undefined;

  const at = (kind: BoTaskKind, stage: string, label: string, tone: BoTaskTone, detail?: string) => {
    const stages = STAGES[kind];
    s = { kind, stages, current: Math.max(0, stages.indexOf(stage)), label, tone, ...(detail ? { detail } : {}) };
  };

  for (const m of messages) {
    if (m.role !== "assistant") continue;
    for (const p of m.parts ?? []) {
      const t = toolOf(p);
      if (!t) continue;
      const kind = KIND_FOR[t.service];
      if (!kind) continue;
      const done = p.state === "output-available";
      const running = p.state === "input-streaming" || p.state === "input-available";

      if (t.service === "cook") {
        if (running) at("cook", "Finding", "Writing a recipe", "working");
        else if (done) at("cook", "Recipe", "Recipe ready", "done", "Start cooking, or ask Bo to get the ingredients.");
        continue;
      }

      // The order / booking call: its own lifecycle around the Approval card.
      if (PLACE.has(t.bare) || t.bare === "book_table" || t.bare === "create_cart") {
        const booking = kind === "dine_in";
        const reason = p.approval ? parseApprovalReason(p.approval.requestReason) : null;
        if (reason?.bill?.toPay) amount = reason.bill.toPay.value;
        const out = p.output as { aborted?: boolean; reason?: string } | null | undefined;
        if (p.state === "approval-requested") {
          at(kind, "Your OK", booking ? "Waiting for your OK to book" : "Waiting for your OK", "you", booking ? "Tap Book it or Change on the card." : amount ? `To pay ${amount} — tap Place order or Change on the card.` : "Tap Place order or Change on the card.");
        } else if (p.state === "approval-responded") {
          if (p.approval?.approved) at(kind, "Your OK", booking ? "Booking with Dineout" : "Placing your order", "working");
          else at(kind, booking ? "Slot" : "Cart", "You asked for changes", "you", "Tell Bo what to change. Nothing was placed.");
        } else if (p.state === "output-denied") {
          at(kind, booking ? "Slot" : "Cart", "You asked for changes", "you", "Tell Bo what to change. Nothing was placed.");
        } else if (failed(p)) {
          at(kind, "Your OK", booking ? "Couldn’t book" : "Couldn’t place the order", "warn", "Nothing was charged. Bo will say what happened.");
        } else if (done && out?.reason === "cart_changed") {
          at(kind, "Cart", "The cart changed", "warn", "Nothing was ordered. Bo will show the new bill.");
        } else if (done && out?.aborted) {
          at(kind, booking ? "Slot" : "Cart", "Nothing was placed", "warn");
        } else if (done && /PENDING_PAYMENT/.test(outText(p))) {
          at(kind, "Payment", "Waiting for your payment", "you", (p.input as { generateUPIQR?: unknown } | null)?.generateUPIQR === true ? "Tap Show QR on the card and scan it. Bo confirms it by itself." : "Tap Pay on the card. Bo confirms it by itself.");
        } else if (done) {
          if (booking) at(kind, "Booked", "Table booked", "done", "Your booking is with Dineout.");
          else at(kind, "Placed", "Order placed", "done", amount ? `${amount} · Bo can track it for you.` : "Bo can track it for you.");
        }
        continue;
      }

      if (t.bare === "check_payment_status" && done && !failed(p)) {
        if (/SUCCESS/i.test(outText(p))) at(kind, "Payment", "Payment received — confirming", "working");
        else if (/FAIL/i.test(outText(p))) at(kind, "Payment", "The payment didn’t go through", "warn", "Bo can offer another way to pay.");
        continue;
      }
      if (t.bare === "confirm_order" && done && !failed(p)) {
        at(kind, kind === "dine_in" ? "Booked" : "Placed", kind === "dine_in" ? "Booking confirmed" : "Order placed", "done", amount);
        continue;
      }
      if (TRACK.has(t.bare)) {
        if (done && !failed(p)) at(kind, "Placed", "Order placed — on its way", "done");
        continue;
      }
      // Reads after the order (past orders, payment options) don't move the task back.
      const cur = s as BoTaskStatus | null;
      if (cur && cur.kind === kind && cur.current >= 2) continue;

      const tone: BoTaskTone = failed(p) ? "warn" : "working";
      const pushedBack = failed(p) ? "Swiggy pushed back — Bo will retry or explain." : undefined;
      if (CLEAR.has(t.bare)) at(kind, "Cart", "Starting a fresh cart", tone, pushedBack);
      else if (CART.has(t.bare)) {
        const reading = t.bare === "get_food_cart" || t.bare === "get_cart";
        at(kind, "Cart", running ? (reading ? "Reading your cart" : "Filling your cart") : reading ? "Cart ready" : "Cart updated", tone, pushedBack);
      } else if (SLOT.has(t.bare)) at(kind, "Slot", running ? "Checking open slots" : "Found open slots", tone, pushedBack);
      else at(kind, "Finding", kind === "dine_in" ? "Looking for a table" : kind === "grocery" ? "Looking on Instamart" : "Looking on Swiggy", tone, pushedBack);
    }
  }
  return s;
}
