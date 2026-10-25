"use client";

/**
 * The Approval card: the one place a Bo task waits for the user. Shown for a
 * tool call the server paused for approval (lib/bo/swiggy-tools.ts) —
 * placing a Swiggy / Instamart order, booking a Dineout table, a paid deal.
 *
 * WHAT IT SHOWS, AND WHY
 *   - Swiggy's own bill text (the approval reason), never a total Bo wrote:
 *     the user approves exactly what Swiggy will charge, fees included.
 *   - The payment method Bo will pass, in words ("Cash on delivery", "UPI ·
 *     Google Pay") — payment itself happens in their UPI app or on Swiggy.
 *   - How to cancel AFTER placing, up front: Bo has no cancel tool.
 *   - No badge of its own: Swiggy's "Powered by" badge for the service is
 *     rendered once under the reply (AgentAttribution), which covers the card.
 *
 * Approve / Change answer the SIGNED request through addToolApprovalResponse;
 * the chat then resends on its own (lib/bo/agent-client sendAfterApproval).
 * The server re-checks the cart before placing, so a stale card cannot
 * order a different cart.
 *
 * meshi-b classes only (.card, .pill-*, .badge-*, .t-*) — both root layouts
 * load meshi-b; nothing here may come from one tree's stylesheet.
 */

import { useId } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import { serviceForTool, type SwiggyService } from "@/components/SwiggyAttribution";
import { parseApprovalReason } from "@/lib/bo/agent-client";

export interface ApprovalPart {
  type: string;
  toolName?: string;
  toolCallId?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  approval?: { id: string; requestReason?: string; approved?: boolean };
}

export type Respond = (r: { id: string; approved: boolean; reason?: string }) => unknown;

const UPI_APPS: [RegExp, string][] = [
  [/gpay|google/i, "Google Pay"],
  [/phonepe/i, "PhonePe"],
  [/paytm/i, "Paytm"],
  [/bhim/i, "BHIM"],
  [/cred/i, "CRED"],
  [/amazon/i, "Amazon Pay"],
];

function paymentLabel(input: unknown): string | null {
  const a = (input ?? {}) as Record<string, unknown>;
  const method = typeof a.paymentMethod === "string" ? a.paymentMethod : "";
  if (/^(cash|cod)$/i.test(method)) return "Cash on delivery";
  if (/swiggypay/i.test(method)) return "Swiggy Money";
  if (/upi/i.test(method)) {
    if (a.generateUPIQR === true) return "UPI · scan a QR code";
    const app = typeof a.intentApp === "string" ? UPI_APPS.find(([re]) => re.test(a.intentApp as string))?.[1] : undefined;
    return `UPI · ${app ?? "your UPI app"}`;
  }
  return null;
}

function toolNameOf(p: ApprovalPart): string {
  return p.type === "dynamic-tool" ? p.toolName ?? "" : p.type.startsWith("tool-") ? p.type.slice(5) : "";
}

/** Parts the server paused for the user (a manual approval carries a reason). */
export function isApprovalPart(p: ApprovalPart): boolean {
  return !!p.approval && p.approval.requestReason !== undefined;
}

const SERVICE_KEY: Record<string, SwiggyService> = { food: "food", im: "instamart", dineout: "dineout" };

export function ApprovalCard({ part, respond, busy }: { part: ApprovalPart; respond: Respond; busy: boolean }) {
  const titleId = useId();
  const approval = part.approval!;
  const reason = parseApprovalReason(approval.requestReason);
  const service = SERVICE_KEY[reason.service] ?? serviceForTool(toolNameOf(part));
  const booking = service === "dineout";
  const pay = paymentLabel(part.input);
  const output = (part.output ?? null) as { aborted?: boolean; reason?: string; error?: string } | null;

  let status: { text: string; tone: "ok" | "warn" } | null = null;
  if (part.state === "approval-responded") {
    status = approval.approved
      ? { text: booking ? "Approved — booking with Dineout…" : "Approved — sending to Swiggy…", tone: "ok" }
      : { text: "Not placed. Tell Bo what to change.", tone: "warn" };
  } else if (part.state === "output-denied") {
    status = { text: "Not placed. Tell Bo what to change.", tone: "warn" };
  } else if (part.state === "output-error" || output?.error) {
    status = { text: "Swiggy couldn’t complete this. Bo will tell you what happened.", tone: "warn" };
  } else if (part.state === "output-available") {
    const pending = /PENDING_PAYMENT/.test(typeof part.output === "string" ? part.output : JSON.stringify(part.output ?? ""));
    status =
      pending
        ? { text: "Waiting for your payment — finish it in your UPI app.", tone: "ok" }
        : output?.reason === "cart_changed"
        ? { text: "The cart changed after you approved it, so nothing was ordered. Bo will show the new cart.", tone: "warn" }
        : output?.aborted
          ? { text: "Nothing was ordered.", tone: "warn" }
          : { text: booking ? "Sent to Dineout." : "Sent to Swiggy.", tone: "ok" };
  }
  const waiting = part.state === "approval-requested";

  return (
    <section
      className="card vstack"
      style={{ padding: "18px 20px", gap: 14, boxShadow: waiting ? "inset 0 0 0 2.5px var(--figure-accent)" : undefined }}
      aria-labelledby={titleId}
    >
      <div className="hstack" style={{ gap: 10, flexWrap: "wrap" }}>
        <ShieldCheck width={20} height={20} style={{ color: "var(--figure-accent)", flex: "none" }} aria-hidden />
        <h3 id={titleId} className="t-h2 grow" style={{ margin: 0, minWidth: 160 }}>
          {reason.action}
        </h3>
        {waiting && <span className="badge badge-forest" style={{ flex: "none" }}>Needs your OK</span>}
      </div>

      {reason.summary && (
        <div
          className="t-body"
          style={{
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            maxHeight: 260,
            overflowY: "auto",
            padding: "12px 14px",
            borderRadius: "var(--m-r-tile)",
            background: "var(--m-cream-2)",
            margin: 0,
          }}
          tabIndex={0}
          aria-label={booking ? "Booking details from Dineout" : "Bill from Swiggy"}
        >
          {reason.summary}
        </div>
      )}

      <dl className="vstack" style={{ gap: 6, margin: 0 }}>
        {pay && (
          <div className="hstack" style={{ gap: 8, flexWrap: "wrap" }}>
            <dt className="t-cap" style={{ fontWeight: 700 }}>Pay with</dt>
            <dd className="t-body" style={{ margin: 0 }}>{pay}</dd>
          </div>
        )}
        <dd className="t-cap" style={{ margin: 0 }}>
          {pay && pay !== "Cash on delivery"
            ? "You pay in your UPI app or on Swiggy — Bo never sees your payment details. "
            : ""}
          {booking
            ? "To cancel later, use the Swiggy Dineout app."
            : "Bo can’t cancel once it’s placed — call Swiggy customer care on 080-67466729."}
        </dd>
      </dl>

      {waiting ? (
        <div className="hstack" style={{ gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="pill-primary pill-sm"
            disabled={busy}
            onClick={() => void respond({ id: approval.id, approved: true })}
          >
            <Check width={16} height={16} aria-hidden />
            {booking ? "Book it" : "Place order"}
          </button>
          <button
            type="button"
            className="pill-secondary pill-sm"
            disabled={busy}
            onClick={() => void respond({ id: approval.id, approved: false, reason: "The user wants to change something." })}
          >
            <X width={16} height={16} aria-hidden />
            Change
          </button>
        </div>
      ) : (
        status && (
          <span
            className="t-body"
            role="status"
            style={{ fontWeight: 700, color: status.tone === "ok" ? "var(--figure-accent)" : "var(--text-burnt)" }}
          >
            {status.text}
          </span>
        )
      )}
    </section>
  );
}
