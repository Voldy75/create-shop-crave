"use client";

import { useRouter } from "next/navigation";
import { Check, ChefHat, CalendarRange } from "lucide-react";

/**
 * meshi Buy ④ — Order confirmed (v2-buy-journey ScreenOrderConfirmed). Success
 * state with a placed→delivered stepper and "while you wait" suggestions.
 * Reachable as a post-order success screen (e.g. after an agent order completes
 * or a platform handoff). Generic since order metadata varies by platform.
 */

const STEPS = [
  { l: "Placed", state: "active" as const },
  { l: "Shopping", state: "pending" as const },
  { l: "On the way", state: "pending" as const },
  { l: "Delivered", state: "pending" as const },
];

export default function OrderConfirmed() {
  const router = useRouter();
  return (
    <div className="col" style={{ minHeight: "100dvh", background: "var(--cc-bg)" }}>
      <div style={{ padding: "calc(env(safe-area-inset-top,12px) + 6px) 14px 10px", display: "flex", justifyContent: "flex-end" }}>
        <button onClick={() => router.push("/m")} style={{ background: "none", border: "none", color: "var(--cc-ink-2)" }} aria-label="Close">✕</button>
      </div>

      <div className="col" style={{ alignItems: "center", padding: "20px 24px 0", textAlign: "center" }}>
        <div style={{ width: 84, height: 84, borderRadius: "50%", background: "var(--cc-pos)", display: "grid", placeItems: "center", boxShadow: "0 0 0 12px rgba(48,209,88,0.14), 0 0 0 24px rgba(48,209,88,0.07)" }}>
          <Check width={44} height={44} style={{ color: "#fff" }} />
        </div>
        <h1 className="t-h1" style={{ marginTop: 22 }}>Order placed</h1>
        <p className="t-body" style={{ color: "var(--cc-ink-2)", marginTop: 6, maxWidth: 280 }}>
          You&apos;ll get updates here and via notifications as it&apos;s shopped and delivered.
        </p>
      </div>

      <div className="scroll" style={{ flex: 1, padding: "24px 14px 12px" }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Your order</span>
            <span className="chip" style={{ fontSize: 10, background: "rgba(48,209,88,0.14)", color: "var(--cc-pos)", borderColor: "transparent" }}>CONFIRMED</span>
          </div>
          <div style={{ position: "relative", padding: "8px 4px 0" }}>
            <div style={{ position: "absolute", left: 12, right: 12, top: 13, height: 2, background: "var(--cc-surf-3)", borderRadius: 2 }} />
            <div style={{ position: "absolute", left: 12, top: 13, height: 2, width: "calc((100% - 24px) / 3)", background: "var(--cc-acc)", borderRadius: 2 }} />
            <div className="row" style={{ justifyContent: "space-between", position: "relative" }}>
              {STEPS.map((s) => (
                <div key={s.l} className="col" style={{ alignItems: "center", gap: 6, width: 60 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: s.state === "active" ? "var(--cc-acc)" : "transparent", boxShadow: s.state === "active" ? "0 0 0 4px var(--cc-acc-dim)" : "none", border: s.state === "pending" ? "1.5px solid var(--cc-line-2)" : "none" }} />
                  <span className="t-cap" style={{ fontSize: 9, textAlign: "center", lineHeight: 1.15, color: s.state === "active" ? "var(--cc-acc)" : "var(--cc-ink-4)" }}>{s.l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="t-cap" style={{ padding: "20px 6px 8px" }}>WHILE YOU WAIT</div>
        <div className="col" style={{ gap: 8 }}>
          <button onClick={() => router.push("/m/recipe")} className="card row" style={{ padding: 12, gap: 12, textAlign: "left" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--cc-acc-dim)", color: "var(--cc-acc)", display: "grid", placeItems: "center", flexShrink: 0 }}><ChefHat width={20} height={20} /></div>
            <div className="col" style={{ flex: 1 }}><span style={{ fontSize: 14, fontWeight: 600 }}>Review the recipe</span><span className="t-small" style={{ fontSize: 11 }}>Prep while you wait</span></div>
          </button>
          <button onClick={() => router.push("/m/plan")} className="card row" style={{ padding: 12, gap: 12, textAlign: "left" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--cc-acc-dim)", color: "var(--cc-acc)", display: "grid", placeItems: "center", flexShrink: 0 }}><CalendarRange width={20} height={20} /></div>
            <div className="col" style={{ flex: 1 }}><span style={{ fontSize: 14, fontWeight: 600 }}>Plan the rest of your week</span><span className="t-small" style={{ fontSize: 11 }}>Tracker &amp; meal plan</span></div>
          </button>
        </div>

        <button onClick={() => router.push("/m")} className="pill-primary" style={{ marginTop: 20 }}>Done</button>
      </div>
    </div>
  );
}
