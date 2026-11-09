/**
 * Bo's tool policy — which Swiggy tools run on their own, which wait for the
 * user's approval tap, and which Bo may never call. Owner decision
 * (2026-10-25): Bo decides everything except money and bookings.
 *
 * Keyed by "<service>.<tool>" (service = mcp_provider_servers.service_key),
 * because the same bare name means different things per service — Dineout's
 * create_cart starts a PAID deal, Instamart has no such tool.
 *
 * The unknown case is the important one: Swiggy adds tools over time. A tool
 * Swiggy marks read-only (annotations.readOnlyHint) runs; any OTHER tool not
 * listed here waits for the user's approval. A new write tool can therefore
 * never run unnoticed — it can only cost the user a tap.
 */

export type ToolDecision =
  | { kind: "run" }
  | { kind: "approve"; action: string }
  | { kind: "deny"; reason: string };

/** Spends money or books something: the user approves every call. */
export const APPROVAL_REQUIRED: Record<string, string> = {
  "food.place_food_order": "Place this Swiggy order",
  "im.checkout": "Place this Instamart order",
  "dineout.book_table": "Book this table",
  "dineout.create_cart": "Start this paid Dineout deal",
};

/**
 * Writes that change only a cart or finish an order the user already
 * approved. Bo does these itself — building the cart is the "heavy lifting"
 * the owner wants automated. confirm_order only finalises an order that went
 * through APPROVAL_REQUIRED, and Swiggy requires it on every terminal payment
 * state (including timeout, which marks the order failed).
 */
export const AUTO_WRITES = new Set([
  "food.update_food_cart",
  "food.flush_food_cart",
  "food.apply_food_coupon",
  "food.confirm_order",
  "im.update_cart",
  "im.clear_cart",
  "im.confirm_order",
  "dineout.confirm_order",
]);

/** Never from Bo: account changes and Swiggy's own bug-report tool. */
export const NEVER: Record<string, string> = {
  "food.create_address": "Bo does not add addresses. Ask the user to add it in the Swiggy app.",
  "food.delete_address": "Bo does not delete addresses.",
  "im.create_address": "Bo does not add addresses. Ask the user to add it in the Swiggy app.",
  "im.delete_address": "Bo does not delete addresses.",
  "food.report_error": "Not available.",
  "im.report_error": "Not available.",
  "dineout.report_error": "Not available.",
};

export function decide(service: string, tool: string, readOnlyHint: boolean): ToolDecision {
  const key = `${service}.${tool}`;
  if (NEVER[key]) return { kind: "deny", reason: NEVER[key] };
  if (APPROVAL_REQUIRED[key]) return { kind: "approve", action: APPROVAL_REQUIRED[key] };
  if (AUTO_WRITES.has(key) || readOnlyHint) return { kind: "run" };
  return { kind: "approve", action: `Let Bo use Swiggy's ${tool.replace(/_/g, " ")}` };
}

/** Tools whose call places an order or books — the cart fingerprint check applies. */
export const PLACES_ORDER = new Set(["food.place_food_order", "im.checkout"]);
