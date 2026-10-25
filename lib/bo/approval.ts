/**
 * What the user approves, and proof it has not changed since.
 *
 * Swiggy's cart tools answer in TEXT (markdown with embedded "(ID: …)" ids
 * and ₹ amounts), not structured JSON — measured in the Phase 2 spike. So:
 *
 *   summary      the cart text Swiggy itself produced, trimmed, shown on the
 *                Approval card. Bo never writes the bill; Swiggy does.
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

/** Text content of an MCP tool result. */
export function resultText(result: unknown): string {
  const content = (result as { content?: unknown })?.content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((c): c is { type: "text"; text: string } => !!c && c.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("\n");
}

export function cartSummary(text: string): string {
  const clean = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return clean.length > SUMMARY_MAX ? `${clean.slice(0, SUMMARY_MAX - 1)}…` : clean;
}

const MONEY = /₹\s?([\d,]+(?:\.\d+)?)/g;
const IDS = /\bID:\s*([\w-]+)/gi;
const QTY = /(?:\bqty|\bquantity|×|\bx)\s*:?\s*(\d+)/gi;

export function cartFingerprint(text: string): string {
  const pick = (re: RegExp) => Array.from(text.matchAll(re), (m) => m[1].replace(/,/g, ""));
  const basis = [pick(MONEY).join(","), pick(IDS).join(","), pick(QTY).join(",")].join("|");
  return createHash("sha256").update(basis).digest("hex").slice(0, 32);
}

/** An empty or unreadable cart cannot be approved. */
export function cartLooksEmpty(text: string): boolean {
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
