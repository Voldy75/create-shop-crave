"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { X, Crown, Check, Loader2 } from "lucide-react";
import {
  fetchBillingOptions,
  startCheckout,
  restorePurchases,
  type BillingOptions,
} from "@/lib/billing";

/**
 * meshi Paywall. Cinematic dark, feature list, selectable plans.
 *
 * COMPLIANCE — read before editing the copy on this screen.
 *
 * Apple requires In-App Purchase for digital subscriptions (Guideline 3.1.1),
 * and anti-steering rules forbid pointing users at an external way to pay.
 * This screen previously rendered the literal string "finish on the web app for
 * now", which is exactly the sentence that gets an app rejected.
 *
 * The paid plans are therefore shown ONLY when the platform can actually
 * transact (see lib/billing.ts). On iOS today that is false until RevenueCat
 * products exist, so the screen offers just the free BYOK path — compliant and
 * shippable, instead of a purchase button that cannot complete.
 */

type Plan = "yearly" | "monthly" | "byok";

const FEATURES: [string, string][] = [
  ["Unlimited AI chat", "No daily caps — explore as much as you cook"],
  ["Faster Gemini 2.5 Flash", "Recipes in under 4 seconds"],
  ["Weekly meal planner", "Auto-fill 7 days in one tap"],
  ["Grocery bundles", "Buy a whole week of ingredients in one button"],
];

const PLANS: { id: Plan; l: string; p: string; s: string; best?: boolean }[] = [
  { id: "yearly", l: "Yearly", p: "₹2,990", s: "₹249 / mo · save 38%", best: true },
  { id: "monthly", l: "Monthly", p: "₹399", s: "₹399 / mo" },
  { id: "byok", l: "Bring your own API key", p: "Free", s: "Use your Gemini / OpenAI / Anthropic key" },
];

export default function MobilePaywall() {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>("yearly");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const [options, setOptions] = useState<BillingOptions | null>(null);

  useEffect(() => {
    void fetchBillingOptions().then(setOptions);
  }, []);

  // Until billing options load, assume no purchase is possible. Showing paid
  // plans first and hiding them a moment later would flash non-compliant UI.
  const canPurchase = options?.canPurchase ?? false;

  const start = async () => {
    if (plan === "byok" || !canPurchase) {
      router.push("/m/profile");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const result = await startCheckout(options!, plan === "yearly" ? "pro" : "pro");
      if (result.status === "redirect") {
        window.location.href = result.url;
      } else if (result.status === "ok") {
        setNote("Checkout started.");
      } else {
        setNote(result.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    const result = await restorePurchases();
    setNote(
      result.status === "ok" || result.status === "redirect"
        ? "Purchases restored."
        : result.message
    );
  };

  return (
    <div className="col" style={{ minHeight: "100dvh", background: "#000", color: "#fff", position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 200, background: "radial-gradient(80% 100% at 50% 0%, rgba(255,107,53,0.45), transparent 70%)" }} />

      <div style={{ padding: "calc(env(safe-area-inset-top,12px) + 6px) 18px 0", position: "relative" }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)" }} aria-label="Close"><X width={22} height={22} /></button>
          {/* Restore Purchases is MANDATORY on iOS for any app selling a
              subscription. It previously rendered as inert text with no
              handler, which is a rejection in itself. */}
          {canPurchase && (
            <button
              onClick={onRestore}
              className="t-small"
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)" }}
            >
              Restore
            </button>
          )}
        </div>
      </div>

      <div className="scroll" style={{ flex: 1, padding: "24px 22px 0" }}>
        <div className="row" style={{ gap: 6, marginBottom: 14 }}>
          <Crown width={22} height={22} style={{ color: "var(--cc-acc)" }} />
          <span className="t-cap" style={{ color: "var(--cc-acc)" }}>MESHI PRO</span>
        </div>
        <h1 className="t-display" style={{ fontSize: 36, color: "#fff" }}>
          Unlimited<br />cravings.<br /><span style={{ color: "rgba(255,255,255,0.5)" }}>One subscription.</span>
        </h1>

        <div className="col" style={{ gap: 12, marginTop: 28 }}>
          {FEATURES.map(([t, s]) => (
            <div key={t} className="row" style={{ gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--cc-acc)", display: "grid", placeItems: "center", flexShrink: 0 }}><Check width={16} height={16} style={{ color: "#fff" }} /></div>
              <div className="col" style={{ gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{t}</span>
                <span className="t-small" style={{ color: "rgba(255,255,255,0.6)" }}>{s}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="col" style={{ gap: 10, marginTop: 28 }}>
          {/* Paid tiers appear only where the platform can actually transact.
              On iOS without configured StoreKit products that is false, so this
              collapses to the free BYOK option rather than advertising a price
              we cannot legally charge here. */}
          {PLANS.filter((pl) => canPurchase || pl.id === "byok").map((pl) => {
            const on = plan === pl.id;
            return (
              <button key={pl.id} onClick={() => setPlan(pl.id)} className="card" style={{ padding: 14, textAlign: "left", background: on ? "rgba(255,107,53,0.14)" : "var(--cc-surf-1)", borderColor: on ? "var(--cc-acc)" : "var(--cc-line)" }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="col" style={{ gap: 2 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{pl.l}</span>
                      {pl.best && <span className="chip" style={{ background: "var(--cc-acc)", color: "#fff", borderColor: "transparent", fontSize: 9, padding: "2px 8px" }}>BEST VALUE</span>}
                    </div>
                    <span className="t-small" style={{ color: "rgba(255,255,255,0.6)" }}>{pl.s}</span>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{pl.p}</div>
                </div>
              </button>
            );
          })}
        </div>
        {note && <p className="t-small" style={{ marginTop: 14, color: "var(--cc-acc)" }}>{note}</p>}
      </div>

      <div style={{ padding: "14px 18px calc(18px + env(safe-area-inset-bottom,0px))" }}>
        <button className="pill-primary" onClick={start} disabled={busy}>
          {busy ? <Loader2 width={16} height={16} className="animate-spin" /> : null}
          {plan === "byok" || !canPurchase ? "Use my own key" : "Start Pro"}
        </button>
        {/* "Auto-renews" would be a false claim when the only offer on screen
            is the free bring-your-own-key path. */}
        {canPurchase && plan !== "byok" && (
          <p className="t-small" style={{ textAlign: "center", marginTop: 10, color: "rgba(255,255,255,0.5)" }}>
            Cancel anytime · Auto-renews
          </p>
        )}
      </div>
    </div>
  );
}
