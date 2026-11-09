"use client";

/**
 * The Approval card: the one place a Bo task waits for the user. Shown for a
 * tool call the server paused for approval (lib/bo/swiggy-tools.ts) —
 * placing a Swiggy / Instamart order, booking a Dineout table, a paid deal.
 *
 * WHAT IT SHOWS, AND WHY
 *   - Swiggy's own bill (the approval reason): items, every fee line and
 *     "To Pay", lifted from Swiggy's cart data — never a total Bo wrote, so
 *     the user approves exactly what Swiggy will charge. Old/odd carts with
 *     no structured data fall back to Swiggy's text.
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
import { Check, ExternalLink, MapPin, QrCode, RefreshCw, ShieldCheck, X } from "lucide-react";
import { serviceForTool, type SwiggyService } from "@/components/SwiggyAttribution";
import { parseApprovalReason } from "@/lib/bo/agent-client";
import type { CartBill } from "@/lib/bo/approval";
import type { PaymentOutcome } from "@/lib/bo/use-task-follow";
import { isNative, openOutside } from "@/lib/native-bridge";

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

/** The chat's view of the payment: the outcome, and which order it belongs to. */
export interface CardPayment {
  result?: PaymentOutcome;
  latestKey: string | null;
  /** Sends a message to Bo; only set on the conversation's last reply. */
  ask?: (text: string) => void;
}

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
    if (a.generateUPIQR === true) return "UPI · QR code";
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

const ROW = { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 } as const;
const NUM = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", flex: "none" } as const;
const RULE = { border: 0, borderTop: "1px solid var(--m-cream)", margin: "2px 0" } as const;

/** Swiggy's bill as rows: where it goes, what's in it, every fee, To Pay. */
function Bill({ bill, label }: { bill: CartBill; label: string }) {
  return (
    <div
      className="vstack"
      style={{ gap: 10, padding: "14px 16px", borderRadius: "var(--m-r-tile)", background: "var(--m-cream-2)", maxHeight: 420, overflowY: "auto" }}
      tabIndex={0}
      role="group"
      aria-label={label}
    >
      {bill.deliverTo && (
        <div className="hstack t-cap" style={{ gap: 6 }}>
          <MapPin width={14} height={14} aria-hidden style={{ flex: "none", color: "var(--figure-accent)" }} />
          <span>Deliver to {bill.deliverTo}</span>
        </div>
      )}
      <ul className="vstack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 10 }}>
        {bill.items.map((it, i) => (
          <li key={i} style={ROW}>
            <span className="vstack" style={{ gap: 2, minWidth: 0 }}>
              <span className="t-body" style={{ fontSize: 14, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {it.name}
              </span>
              <span className="t-cap">
                {[it.variant, `Qty ${it.qty}`].filter(Boolean).join(" · ")}
                {!it.available && <span style={{ color: "var(--text-burnt)" }}> · Out of stock</span>}
              </span>
            </span>
            {it.price && (
              <span className="vstack" style={{ ...NUM, alignItems: "flex-end", gap: 2 }}>
                <span className="t-body" style={{ fontSize: 14 }}>{it.price}</span>
                {it.mrp && (
                  <s className="t-cap">{it.mrp}</s>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
      {bill.lines.length > 0 && (
        <>
          <hr style={RULE} />
          <dl className="vstack" style={{ margin: 0, gap: 6 }}>
            {bill.lines.map((l, i) => (
              <div key={i} className="t-cap" style={ROW}>
                <dt>{l.label}</dt>
                <dd style={{ ...NUM, margin: 0 }}>{l.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {bill.toPay && (
        <>
          <hr style={RULE} />
          <div style={ROW}>
            <span className="t-h2">{bill.toPay.label}</span>
            <span className="t-h2" style={{ ...NUM, fontSize: 20 }}>{bill.toPay.value}</span>
          </div>
        </>
      )}
    </div>
  );
}

const SERVICE_KEY: Record<string, SwiggyService> = { food: "food", im: "instamart", dineout: "dineout" };

/** Once the payment has an outcome the Pay link is dead, so this replaces it. */
const PAYMENT_ENDED: Record<Exclude<PaymentOutcome, "pending">, { text: string; tone: "ok" | "warn" }> = {
  success: { text: "Paid. Your order is confirmed.", tone: "ok" },
  failed: { text: "The payment didn’t go through. Nothing was ordered.", tone: "warn" },
  refund: { text: "Swiggy started a refund.", tone: "warn" },
  timeout: { text: "Bo didn’t see your payment in time, so it closed the order. If you paid, check it in the Swiggy app.", tone: "warn" },
};

/**
 * What the user says to Bo to start over. No button after a refund, and the
 * words rule out a double payment after a timeout, where they may have paid.
 */
const TRY_AGAIN: Partial<Record<PaymentOutcome, { label: string; say: string }>> = {
  failed: { label: "Pay another way", say: "Pay another way" },
  timeout: { label: "I didn’t pay, pay another way", say: "I didn’t pay. Pay another way." },
};

export function ApprovalCard({ part, respond, busy, payment }: { part: ApprovalPart; respond: Respond; busy: boolean; payment?: CardPayment }) {
  const titleId = useId();
  const approval = part.approval!;
  const reason = parseApprovalReason(approval.requestReason);
  const service = SERVICE_KEY[reason.service] ?? serviceForTool(toolNameOf(part));
  const booking = service === "dineout";
  const pay = paymentLabel(part.input);
  const output = (part.output ?? null) as { aborted?: boolean; reason?: string; error?: string; payUrl?: string; paymentKey?: string } | null;
  const replaced = !!output?.paymentKey && !!payment?.latestKey && output.paymentKey !== payment.latestKey;
  const paymentResult = replaced ? undefined : payment?.result;
  const ended = replaced
    ? { text: "This payment has ended. Your newer order is below.", tone: "warn" as const }
    : paymentResult && paymentResult !== "pending"
      ? PAYMENT_ENDED[paymentResult]
      : null;
  const tryAgain = paymentResult && payment?.ask ? TRY_AGAIN[paymentResult] : undefined;
  const payUrl = !ended && typeof output?.payUrl === "string" && /^https:\/\//i.test(output.payUrl) ? output.payUrl : null;
  const qr = (part.input as { generateUPIQR?: unknown } | null)?.generateUPIQR === true;

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
        ? ended
          ? ended
          : payUrl
          ? { text: qr ? "Waiting for your payment — tap Show QR and scan it with any UPI app." : "Waiting for your payment — tap Pay to finish it in your UPI app.", tone: "ok" }
          : { text: "Swiggy didn’t send a payment link, so this can’t be paid here. It will close by itself.", tone: "warn" }
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

      {reason.bill ? (
        <Bill bill={reason.bill} label={booking ? "Booking details from Dineout" : "Bill from Swiggy"} />
      ) : reason.summary && (
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
            onClick={() =>
              void respond({
                id: approval.id,
                approved: false,
                reason: "The user tapped Change on the Approval card. Nothing was placed and nothing failed — ask what they want to change.",
              })
            }
          >
            <X width={16} height={16} aria-hidden />
            Change
          </button>
        </div>
      ) : (
        status && (
          <div className="vstack" style={{ gap: 10, alignItems: "flex-start" }}>
            <span
              className="t-body"
              role="status"
              style={{ fontWeight: 700, color: status.tone === "ok" ? "var(--figure-accent)" : "var(--text-burnt)" }}
            >
              {status.text}
            </span>
            {payUrl && (
              <a
                href={payUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="pill-primary pill-sm"
                style={{ textDecoration: "none" }}
                onClick={(e) => {
                  // The app's WebView ignores target="_blank".
                  if (!isNative()) return;
                  e.preventDefault();
                  void openOutside(payUrl);
                }}
              >
                {qr ? <QrCode width={16} height={16} aria-hidden /> : <ExternalLink width={16} height={16} aria-hidden />}
                {qr ? "Show QR" : "Pay"}{reason.bill?.toPay?.value ? ` ${reason.bill.toPay.value}` : ""}
              </a>
            )}
            {tryAgain && (
              <button type="button" className="pill-primary pill-sm" disabled={busy} onClick={() => payment?.ask?.(tryAgain.say)}>
                <RefreshCw width={16} height={16} aria-hidden />
                {tryAgain.label}
              </button>
            )}
          </div>
        )
      )}
    </section>
  );
}
