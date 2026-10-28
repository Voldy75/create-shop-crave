/**
 * What the user approves, and proof it has not changed since.
 *
 * Swiggy's cart tools answer with instructions for the model, then the cart
 * as JSON, also sent as `structuredContent` (Instamart get_cart, measured
 * 2026-10-28). The first card showed that text raw — model instructions, the
 * user's phone number and map coordinates, cut off before the total. So:
 *
 *   bill         Swiggy's own items, fee lines, "To Pay" and the address
 *                label, lifted field by field from the cart JSON. Bo never
 *                writes the bill; Swiggy does. No phone, coordinates or ids.
 *   summary      fallback text when a cart has no JSON: Swiggy's text with
 *                the model instructions dropped.
 *   fingerprint  a hash over the parts that matter for money — every ₹ amount,
 *                every id, every quantity — in order. ETAs, greetings and
 *                offer copy can change between the tap and the order without
 *                a false alarm; a changed item, quantity, fee or total cannot.
 *
 * The fingerprint is stored with the approval request (agent_task_events) and
 * re-checked against a FRESH cart immediately before the order is placed. If
 * Bo, Swiggy or the user (in the Swiggy app) changed the cart in between, the
 * order is not placed and the user is asked again.
 *
 * Pure: no I/O.
 */

import { createHash } from "node:crypto";

const SUMMARY_MAX = 1200;

/** Swiggy's bill as the Approval card renders it. Strings are Swiggy's own. */
export interface CartBill {
  items: { name: string; variant?: string; qty: number; price?: string; mrp?: string; available: boolean }[];
  lines: { label: string; value: string }[];
  toPay: { label: string; value: string } | null;
  /** "Work · B17, Mumbai" — the saved address's label and area, nothing finer. */
  deliverTo: string | null;
}

/** Text content of an MCP tool result. */
export function resultText(result: unknown): string {
  const content = (result as { content?: unknown })?.content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((c): c is { type: "text"; text: string } => !!c && c.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("\n");
}

/** The cart object: `structuredContent` when Swiggy sends it, else the JSON
 *  block at the end of the text. null when neither is there. */
export function cartJson(result: unknown, text = resultText(result)): Record<string, unknown> | null {
  const sc = (result as { structuredContent?: unknown })?.structuredContent;
  if (sc && typeof sc === "object" && !Array.isArray(sc)) return sc as Record<string, unknown>;
  const at = text.indexOf("\n{");
  if (at < 0) return null;
  try {
    const v = JSON.parse(text.slice(at + 1));
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : undefined;
const pick = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => str(o[k])).find((v) => v !== undefined);
const rupees = (v: string | undefined) => (v === undefined ? undefined : /₹/.test(v) ? v : `₹${v}`);
const titleCase = (v: string) => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();

/**
 * The bill from a cart object. Tolerant of field names, because only the
 * Instamart shape has been measured; Food carts are read with the same
 * fallbacks. null when there are no items — the card then uses `summary`.
 */
export function cartBill(cart: Record<string, unknown> | null): CartBill | null {
  if (!cart) return null;
  const rawItems = Array.isArray(cart.items) ? cart.items : Array.isArray(cart.cartItems) ? cart.cartItems : [];
  const items = rawItems
    .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
    .map((i) => {
      const qty = Number(i.quantity ?? i.qty ?? 1);
      const price = rupees(pick(i, ["discountedFinalPrice", "finalPrice", "totalPrice", "offerPrice", "price", "total"]));
      const mrp = rupees(pick(i, ["mrp"]));
      return {
        name: pick(i, ["itemName", "name", "displayName", "title"]) ?? "Item",
        variant: pick(i, ["itemVariant", "variant", "quantityDescription", "variantName"]),
        qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
        price,
        mrp: mrp && mrp !== price ? mrp : undefined,
        available: i.isInStockAndAvailable !== false && i.inStock !== false,
      };
    });
  if (!items.length) return null;

  const bd = (cart.billBreakdown ?? cart.bill ?? {}) as Record<string, unknown>;
  const lines = (Array.isArray(bd.lineItems) ? bd.lineItems : [])
    .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
    .map((l) => ({ label: str(l.label) ?? "", value: rupees(str(l.value)) ?? "" }))
    .filter((l) => l.label && l.value);
  const tp = (bd.toPay ?? null) as Record<string, unknown> | null;
  const total = rupees(str(tp?.value)) ?? rupees(pick(cart, ["cartTotalAmount", "toPay", "total"]));
  const toPay = total ? { label: str(tp?.label) ?? "To Pay", value: total } : null;

  const addr = (cart.selectedAddressDetails ?? cart.address ?? null) as Record<string, unknown> | null;
  const label = addr ? str(addr.annotation) ?? str(addr.category) : undefined;
  const where = addr ? [str(addr.area), str(addr.city)].filter(Boolean).join(", ") : "";
  const deliverTo = label || where ? [label && titleCase(label), where].filter(Boolean).join(" · ") : null;

  return { items, lines, toPay, deliverTo };
}

export function cartSummary(text: string): string {
  // Keep Swiggy's words, drop what is for the model: the JSON block and the
  // "display this as a table / a widget may be shown" instructions.
  const at = text.indexOf("\n{");
  const prose = (at >= 0 ? text.slice(0, at) : text)
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .filter((para) => !/please display|tabular|widget|get_payment_options|do not list|swiggy one status/i.test(para))
    .join("\n\n");
  const clean = prose.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return clean.length > SUMMARY_MAX ? `${clean.slice(0, SUMMARY_MAX - 1)}…` : clean;
}

const MONEY = /₹\s?([\d,]+(?:\.\d+)?)/g;
const IDS = /\bID:\s*([\w-]+)/gi;
const QTY = /(?:\bqty|\bquantity|×|\bx)\s*:?\s*(\d+)/gi;

/** Over the bill when Swiggy sent one (names, quantities, every amount),
 *  else over the ₹ amounts, ids and quantities in the text. Both reads of a
 *  cart (at the request and before placing) take the same path. */
export function cartFingerprint(text: string, bill: CartBill | null = null): string {
  const grab = (re: RegExp) => Array.from(text.matchAll(re), (m) => m[1].replace(/,/g, ""));
  const basis = bill
    ? JSON.stringify([bill.items.map((i) => [i.name, i.variant, i.qty, i.price]), bill.lines, bill.toPay])
    : [grab(MONEY).join(","), grab(IDS).join(","), grab(QTY).join(",")].join("|");
  return createHash("sha256").update(basis).digest("hex").slice(0, 32);
}

/** An empty or unreadable cart cannot be approved. */
export function cartLooksEmpty(text: string, bill: CartBill | null = null): boolean {
  if (bill) return false;
  if (/"cartAbsent"\s*:\s*true/.test(text)) return true;
  return !/₹\s?\d/.test(text) || /cart is empty|no items in (your )?cart/i.test(text);
}

/**
 * The approval card text for a Dineout booking — there is no cart to read,
 * so the summary is built from the slot Bo picked. Only fields the user
 * needs to recognise the booking; no coordinates. No fingerprint is needed:
 * every booking detail is in the tool input, which the approval signature
 * already covers (a changed input fails verification).
 */
export function bookingSummary(args: Record<string, unknown>): string {
  const when =
    typeof args.reservationTime === "number"
      ? new Date(args.reservationTime * (args.reservationTime < 1e12 ? 1000 : 1)).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "the chosen time";
  const guests = typeof args.guestCount === "number" ? args.guestCount : "?";
  const paid = args.paymentMethod === "UPI" ? " — paid deal, pay in your UPI app" : "";
  return `Table for ${guests} at ${when}${paid}.`;
}
