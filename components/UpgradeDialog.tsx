"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Key, Loader2, AlertCircle, Check } from "lucide-react";
import type { Provider } from "@/lib/providers";
import { PROVIDERS } from "@/lib/providers";
import {
  fetchBillingOptions,
  formatPrice,
  offersFor,
  intervalLabel,
  renewalNote,
  perMonth,
  PLAN_FEATURES,
  type BillingOptions,
} from "@/lib/billing";
import { BoBowl, Mushroom, Beet } from "@/components/mascots";

interface UpgradeDialogProps {
  onProActivated: () => void;
  onBYOKSave: (provider: Provider, apiKey: string) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

/**
 * Paywall — artboard w5a, a modal over the app.
 *
 * ── THREE LIVE FALSE CLAIMS were fixed here. Read before editing the copy. ──
 *
 * This screen is a payment screen, so every number and every renewal promise on
 * it has to match what the backend actually charges. It did not:
 *
 *  1. **"Pay ₹749/month via Razorpay" was wrong twice over.** The price was
 *     hardcoded rather than read from DB-backed `plan_prices`, and Razorpay is
 *     NOT monthly — `app/api/subscribe/razorpay/verify` grants exactly 31 days
 *     once and nothing reschedules it. Prices now come from
 *     `fetchBillingOptions()` and the renewal terms from `renewalNote()`.
 *  2. **"Pay $9/month via Stripe" was likewise hardcoded**, and rendering both
 *     providers put two currencies for the same plan side by side. `offersFor`
 *     shows only the provider that will actually be charged.
 *  3. **"Cancel anytime. No hidden fees."** There is nothing to cancel on a
 *     one-time charge. The footer is derived from the chosen interval now.
 *
 * The mobile paywall fixed exactly this class of bug during its own re-skin;
 * the helpers are shared from `lib/billing` so the two cannot drift apart
 * again and start quoting different terms for the same charge.
 *
 * **The artboard's own numbers are stale and were NOT copied**: it draws
 * "Yearly · ₹2,990" and "Monthly · ₹399", neither of which exists in
 * `plan_prices`, plus "7 days free" and a "Start free week" CTA. **There is no
 * trial** — checkout charges immediately — so that button would be a false
 * promise on a payment screen. Its "All 4 models" is wrong too; `lib/providers`
 * has three.
 *
 * BYOK stays a first-class third option, as w5a draws it, because it is the
 * genuinely free path and the only one available when `canPurchase` is false.
 */

/** Razorpay renders in a third-party iframe where CSS custom properties do not
 *  resolve, so this MUST be a literal — one of DESIGN.md's allowlisted cases.
 *  It is `--m-forest`'s value; it was the retired Midnight Kitchen orange
 *  until this pass, which meant the Razorpay checkout iframe was the last
 *  user-facing surface still wearing the old brand.
 *  Phase 10d finished the rest of that cleanup — `scripts/gen-resources.mjs`
 *  (with `resources/*.png` regenerated in the same commit), the `assets` npm
 *  script, and `public/manifest.json`. The orange is now gone repo-wide. */
const RAZORPAY_THEME = "#1E5A34"; // hex-ok: third-party iframe, no CSS var support

export function UpgradeDialog({ onProActivated, onBYOKSave, onClose }: UpgradeDialogProps) {
  const [options, setOptions] = useState<BillingOptions | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"plans" | "byok">("plans");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [byokProvider, setByokProvider] = useState<Provider>("gemini");
  const [byokKey, setByokKey] = useState("");
  const [byokError, setByokError] = useState<string | null>(null);

  useEffect(() => {
    void fetchBillingOptions().then((o) => {
      setOptions(o);
      const first = offersFor(o)[0];
      if (first) setSelected(`${first.plan_id}-${first.interval}`);
    });
  }, []);

  // Until options load, assume nothing is purchasable. Showing a price and
  // withdrawing it a moment later is worse than showing it a beat late.
  const canPurchase = options?.canPurchase ?? false;
  const offers = useMemo(() => offersFor(options), [options]);
  const chosen = offers.find((o) => `${o.plan_id}-${o.interval}` === selected) ?? offers[0] ?? null;

  const handleCheckout = async () => {
    if (!chosen) return;
    setLoading(true);
    setError(null);
    try {
      // Provider is whatever plan_prices says will be charged, not a guess.
      if (chosen.provider === "stripe") {
        const res = await fetch("/api/subscribe/stripe", { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to create session");
        window.location.href = data.url;
        return;
      }

      const res = await fetch("/api/subscribe/razorpay", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create order");

      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Razorpay"));
          document.head.appendChild(script);
        });
      }

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        // Names BOTH brands on purpose: the app titles itself "meshi" but the
        // account and this repo are still "Crave & Create". A card statement
        // showing only "meshi" is an unrecognised descriptor — a chargeback
        // waiting to happen. Matches app/(mobile)/layout.tsx's title.
        name: "meshi — Crave & Create",
        // 31 days, not "1 month" — the grant is one-time (see verify route).
        description: "meshi+ — 31 days",
        order_id: data.orderId,
        prefill: { name: data.userName, email: data.userEmail },
        theme: { color: RAZORPAY_THEME },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          setLoading(true);
          const verifyRes = await fetch("/api/subscribe/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            onProActivated();
          } else {
            setError("Payment verification failed. Contact support.");
            setLoading(false);
          }
        },
        modal: { ondismiss: () => setLoading(false) },
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  const handleBYOKSave = () => {
    if (!byokKey.trim()) {
      setByokError("Please enter your API key.");
      return;
    }
    onBYOKSave(byokProvider, byokKey.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "color-mix(in srgb, var(--m-forest-2) 55%, transparent)",
        backdropFilter: "blur(8px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Upgrade to meshi+"
    >
      <div
        className="card paywall-card"
        /* NO inline `overflow: hidden` here — it would beat .paywall-card's
           `overflow: auto` and clip the CTA out of reach on a short viewport.
           `auto` still clips to the border radius. */
        style={{ width: "100%", maxWidth: 760, boxShadow: "var(--m-shadow-lift)" }}
      >
        {/* ── Plum panel — the pitch ── */}
        <div className="paywall-pitch vstack">
          {/* Idle loops from the mascot kit (artboard 1a): mushroom squash-hops,
              Bo bobs, beet bounces — three different moves and durations, so
              the trio reads as characters rather than one mechanical wave.

              The static tilt sits on a WRAPPER, not the svg: every idle move
              animates `transform`, so a `transform: rotate()` on the same
              element would simply be overwritten by the animation. */}
          <div className="hstack" style={{ gap: 2 }}>
            <span style={{ display: "inline-flex", transform: "rotate(-12deg)" }}>
              <Mushroom width={46} height={46} className="mm-idle-mushroom" />
            </span>
            <BoBowl width={64} height={64} className="mm-idle-bo-bowl" />
            <span style={{ display: "inline-flex", transform: "rotate(12deg)" }}>
              <Beet width={46} height={46} className="mm-idle-beet" />
            </span>
          </div>
          <span className="on-plum" style={{ font: "800 27px/1.05 var(--m-font-display)" }}>
            Feed Bo,<br />unlock everything
          </span>
          <span className="t-body on-plum-dim">
            meshi+ turns Bo into your full-time chef, dietitian and hype squad.
          </span>
          <div className="vstack" style={{ gap: 12, marginTop: 6 }}>
            {PLAN_FEATURES.map((f) => (
              <div key={f} className="hstack" style={{ gap: 10 }}>
                <Check width={18} height={18} style={{ color: "var(--m-lime)", flex: "none" }} />
                <span className="t-body on-plum">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Plan picker ── */}
        <div className="vstack grow" style={{ padding: 28, gap: 13, minWidth: 0 }}>
          <div className="hstack" style={{ justifyContent: "space-between" }}>
            <span className="t-d2">{mode === "plans" ? "Choose your plan" : "Use your own key"}</span>
            <button onClick={onClose} className="icon-btn" aria-label="Close">
              <X width={18} height={18} />
            </button>
          </div>

          {error && (
            <div
              className="hstack"
              style={{
                gap: 8,
                padding: 12,
                borderRadius: 12,
                background: "color-mix(in srgb, var(--m-red) 10%, transparent)",
                color: "var(--m-red)",
              }}
            >
              <AlertCircle width={16} height={16} style={{ flex: "none" }} />
              <span className="t-cap" style={{ color: "var(--m-red)" }}>{error}</span>
            </div>
          )}

          {mode === "plans" ? (
            <>
              {offers.map((o) => {
                const key = `${o.plan_id}-${o.interval}`;
                const on = chosen ? `${chosen.plan_id}-${chosen.interval}` === key : false;
                const pm = perMonth(o);
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    aria-pressed={on}
                    className="card hstack"
                    style={{
                      padding: "16px 18px",
                      gap: 12,
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      background: on ? "var(--m-card)" : "var(--m-cream-2)",
                      boxShadow: on ? "inset 0 0 0 3px var(--m-lime)" : "none",
                      cursor: "pointer",
                    }}
                  >
                    <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
                      <span className="t-h2">
                        {intervalLabel(o.interval)} · {formatPrice(o.amount_minor, o.currency)}
                      </span>
                      <span className="t-cap" style={on ? { color: "var(--m-forest)" } : undefined}>
                        {pm ?? "Everything on the left, unlocked"}
                      </span>
                    </div>
                    {/* "Best deal" only means anything when there is more than one. */}
                    {on && offers.length > 1 && <span className="chip-tag chip" style={{ flex: "none" }}>Best deal</span>}
                  </button>
                );
              })}

              {/* BYOK is a real plan row in w5a, and it is the only option at
                  all when the platform cannot transact. */}
              <button
                onClick={() => setMode("byok")}
                className="card hstack"
                style={{
                  padding: "16px 18px",
                  gap: 12,
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  background: "var(--m-cream-2)",
                  boxShadow: "none",
                  cursor: "pointer",
                }}
              >
                <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
                  <span className="t-h2">Bring your own key</span>
                  <span className="t-cap">Free — your key, your quota</span>
                </div>
                <span className="chip" style={{ flex: "none" }}>Set up</span>
              </button>

              {/* The artboard's CTA is "Start free week". There is no trial in
                  this product — checkout charges immediately — so the button
                  states the actual amount instead. */}
              <button
                className="pill-lime"
                style={{ width: "100%", marginTop: 4 }}
                onClick={canPurchase && chosen ? handleCheckout : () => setMode("byok")}
                disabled={loading}
              >
                {loading && <Loader2 width={16} height={16} className="animate-spin" />}
                {canPurchase && chosen
                  ? `Get meshi+ · ${formatPrice(chosen.amount_minor, chosen.currency)}`
                  : "Use my own key"}
              </button>

              <span className="t-cap" style={{ textAlign: "center" }}>
                {canPurchase && chosen
                  ? renewalNote(chosen.interval)
                  : "No card needed. Bo will pretend not to be sad."}
              </span>
            </>
          ) : (
            <>
              <p className="t-body-soft">
                Already have an API key? Use it for unlimited requests — your key, your quota.
              </p>

              <div className="grid grid-cols-3 gap-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setByokProvider(p.id)}
                    aria-pressed={byokProvider === p.id}
                    className="chip"
                    style={{
                      justifyContent: "center",
                      cursor: "pointer",
                      background: byokProvider === p.id ? "var(--m-lime)" : "var(--m-card)",
                      color: byokProvider === p.id ? "var(--m-forest-2)" : "var(--m-ink)",
                      boxShadow: byokProvider === p.id ? "none" : undefined,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="input" style={{ gap: 10 }}>
                <Key width={16} height={16} style={{ color: "var(--m-ink-soft)", flex: "none" }} />
                <input
                  value={byokKey}
                  onChange={(e) => { setByokKey(e.target.value); setByokError(null); }}
                  placeholder={PROVIDERS.find((p) => p.id === byokProvider)?.keyPlaceholder ?? "API Key"}
                  type="password"
                  className="grow"
                  style={{ background: "none", border: "none", outline: "none", color: "var(--m-ink)", font: "600 15px var(--m-font-body)" }}
                />
              </div>
              {byokError && <span className="t-cap" style={{ color: "var(--m-red)" }}>{byokError}</span>}

              <button className="pill-primary" style={{ width: "100%" }} onClick={handleBYOKSave}>
                Use this key
              </button>

              {offers.length > 0 && (
                <button
                  onClick={() => setMode("plans")}
                  className="wlink"
                  style={{ background: "none", border: "none", justifyContent: "center", width: "100%" }}
                >
                  Back to plans
                </button>
              )}

              <span className="t-cap" style={{ textAlign: "center" }}>
                Stored in this browser, never on our servers — it goes only to the AI provider on each request.
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
