"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { X, Check, Loader2 } from "lucide-react";
import {
  fetchBillingOptions,
  formatPrice,
  startCheckout,
  restorePurchases,
  offersFor,
  intervalLabel,
  renewalNote,
  perMonth,
  PLAN_FEATURES,
  type BillingOptions,
} from "@/lib/billing";
import { BoBowl, Mushroom, Beet } from "@/components/mascots";

/**
 * Paywall — built to the Flow 7 artboard (1o).
 *
 * COMPLIANCE — read before editing the copy on this screen.
 *
 * Apple requires In-App Purchase for digital subscriptions (Guideline 3.1.1),
 * and anti-steering rules forbid pointing users at an external way to pay. This
 * screen once rendered the literal string "finish on the web app for now",
 * which is exactly the sentence that gets an app rejected. Paid plans are
 * therefore shown ONLY when the platform can actually transact, and Restore —
 * mandatory on iOS — is wired rather than inert.
 *
 * TWO CORRECTNESS FIXES made during the re-skin:
 *
 *  - Prices are read from billing options (DB-backed `plan_prices`) via
 *    formatPrice, not hardcoded. The old screen hardcoded "₹2,990" / "₹399",
 *    so it could advertise a price different from the one actually charged —
 *    and plan_prices exists precisely because web/iOS/Android prices differ.
 *  - The selected plan is now passed to startCheckout. It previously passed
 *    the literal "pro" for both tiers, making the user's choice meaningless.
 *
 * The artboard's third feature bullet is "Rare mascots (yes, golden
 * pineapple)". Mascot unlocks are an OPEN product question (`.mascot-locked`),
 * not a shipped feature, so selling them here would be selling something that
 * does not exist. Replaced with a benefit that is actually plan-gated.
 */

export default function MobilePaywall() {
  const router = useRouter();
  const [options, setOptions] = useState<BillingOptions | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void fetchBillingOptions().then((o) => {
      setOptions(o);
      const first = offersFor(o)[0];
      if (first) setSelected(`${first.plan_id}-${first.interval}`);
    });
  }, []);

  // Until options load, assume no purchase is possible. Showing paid plans and
  // hiding them a moment later would flash non-compliant UI.
  const canPurchase = options?.canPurchase ?? false;
  const offers = useMemo(() => offersFor(options), [options]);
  // Keyed by plan+interval: one plan can have several intervals.
  const chosen = offers.find((o) => `${o.plan_id}-${o.interval}` === selected) ?? offers[0] ?? null;

  const start = async () => {
    // No purchasable offer → the free bring-your-own-key path, which is the
    // only thing we may legitimately offer here. This used to push to
    // `/m/profile`, which has no key field — a dead end. It now lands on the
    // real 7f key-entry screen.
    if (!canPurchase || !chosen) {
      router.push("/m/settings/key");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const result = await startCheckout(options!, chosen.plan_id);
      if (result.status === "redirect") window.location.href = result.url;
      else if (result.status === "ok") setNote("Checkout started.");
      else setNote(result.message);
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    const result = await restorePurchases();
    setNote(result.status === "ok" || result.status === "redirect" ? "Purchases restored." : result.message);
  };

  return (
    <div className="paywall-shell vstack" style={{ padding: "calc(env(safe-area-inset-top, 12px) + 8px) 24px calc(34px + env(safe-area-inset-bottom, 0px))", gap: 14 }}>
      <div className="hstack" style={{ justifyContent: "space-between" }}>
        {/* Restore Purchases is MANDATORY on iOS for any app selling a
            subscription. It previously rendered as inert text with no handler,
            which is a rejection in itself. */}
        {canPurchase ? (
          <button onClick={onRestore} className="t-cap on-plum-faint" style={{ background: "none", border: "none", padding: 0 }}>
            Restore
          </button>
        ) : (
          <span />
        )}
        <button className="paywall-close" onClick={() => router.back()} aria-label="Close">
          <X width={18} height={18} />
        </button>
      </div>

      {/* Mascot trio */}
      <div className="vstack" style={{ alignItems: "center", gap: 10, textAlign: "center" }}>
        <div className="hstack" style={{ gap: 2 }}>
          <Mushroom width={54} height={54} style={{ transform: "rotate(-12deg)" }} />
          <BoBowl width={76} height={76} />
          <Beet width={54} height={54} style={{ transform: "rotate(12deg)" }} />
        </div>
        <span className="on-plum" style={{ font: "800 34px/1.02 var(--m-font-display)" }}>
          Feed Bo,<br />unlock everything
        </span>
        <span className="t-body on-plum-dim">
          meshi+ turns Bo into your full-time chef, dietitian and hype squad.
        </span>
      </div>

      <div className="vstack" style={{ gap: 9, marginTop: 4 }}>
        {PLAN_FEATURES.map((f) => (
          <div key={f} className="hstack" style={{ gap: 10 }}>
            <Check width={18} height={18} style={{ color: "var(--m-lime)", flex: "none" }} />
            <span className="t-body on-plum">{f}</span>
          </div>
        ))}
      </div>

      <div className="grow" />

      {note && <span className="t-cap on-plum-dim">{note}</span>}

      {/* Paid tiers appear only where the platform can actually transact. On
          iOS without configured StoreKit products that is false, so this
          collapses to the free BYOK option rather than advertising a price we
          cannot legally charge here. */}
      {offers.map((o) => {
        const key = `${o.plan_id}-${o.interval}`;
        const on = chosen ? `${chosen.plan_id}-${chosen.interval}` === key : false;
        const pm = perMonth(o);
        return (
          <button
            key={key}
            onClick={() => setSelected(key)}
            aria-pressed={on}
            className={`card hstack ${on ? "offer-selected" : "offer-muted"}`}
            style={{ padding: "14px 16px", gap: 12, width: "100%", textAlign: "left", border: "none" }}
          >
            <div className="vstack grow" style={{ gap: 0, minWidth: 0 }}>
              <span className={`t-h2 ${on ? "" : "on-plum"}`}>
                {intervalLabel(o.interval)} · {formatPrice(o.amount_minor, o.currency)}
              </span>
              {/* The renewal terms live in the footer; repeating them here just
                  says the same sentence twice. */}
              <span className={`t-cap ${on ? "" : "on-plum-faint"}`} style={on ? { color: "var(--m-forest)" } : undefined}>
                {pm ?? "Everything above, unlocked"}
              </span>
            </div>
            {/* "Best deal" only means something when there is more than one. */}
            {on && offers.length > 1 && <span className="chip-tag chip" style={{ flex: "none" }}>Best deal</span>}
          </button>
        );
      })}

      {!canPurchase && (
        <div className="card offer-muted vstack" style={{ padding: "14px 16px", gap: 2 }}>
          <span className="t-h2 on-plum">Bring your own API key — free</span>
          <span className="t-cap on-plum-faint">Use your own Gemini, OpenAI or Anthropic key for unlimited use.</span>
        </div>
      )}

      {/* The artboard's CTA is "Start free week". There is no trial anywhere in
          this product — checkout charges immediately — so that button would be
          a false promise on a payment screen. */}
      <button className="pill-lime" style={{ width: "100%" }} onClick={start} disabled={busy}>
        {busy && <Loader2 width={16} height={16} className="animate-spin" />}
        {canPurchase && chosen ? `Get meshi+ · ${formatPrice(chosen.amount_minor, chosen.currency)}` : "Use my own key"}
      </button>

      <span className="t-cap on-plum-faint" style={{ textAlign: "center" }}>
        {canPurchase && chosen
          ? `${renewalNote(chosen.interval)} Bo will pretend not to be sad.`
          : "No card needed. Bo will pretend not to be sad."}
      </span>
    </div>
  );
}
