"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { Check, ChefHat, Utensils, ChevronRight, X } from "lucide-react";
import { BoBowl } from "@/components/mascots";

/**
 * Buy ④ — order confirmed, built to the Flow 4 artboard (4f).
 *
 * THE STEPPER SHOWS ONLY WHAT WE KNOW. The artboard labels itself "real
 * stepper" and draws Placed as done with Shopping already in progress, but
 * nothing in this product tracks order state — there is no order table, and no
 * platform reports progress back to us. Rendering "Shopping" as active would
 * be an animation pretending to be telemetry, on the one screen where a user
 * is actively waiting for information.
 *
 * So: Placed is complete because we just did it, and the rest are explicitly
 * upcoming, with a line saying where real updates will come from. When order
 * tracking exists, drive `reached` from it and the visual is already correct.
 */

const STEPS = ["Placed", "Shopping", "On the way", "Delivered"] as const;

/** Index of the last step we can honestly claim has happened. */
const REACHED = 0;

export default function OrderConfirmed() {
  const router = useRouter();

  return (
    <div className="vstack" style={{ minHeight: "100dvh", background: "var(--m-cream)", padding: "calc(env(safe-area-inset-top, 12px) + 8px) 20px 30px", gap: 12 }}>
      <div className="hstack" style={{ justifyContent: "flex-end" }}>
        <button className="icon-btn" onClick={() => router.push("/m")} aria-label="Close"><X width={18} height={18} /></button>
      </div>

      <div className="vstack" style={{ alignItems: "center", gap: 10, textAlign: "center", marginTop: 6 }}>
        <div className="confirm-halo">
          <BoBowl width={104} height={104} style={{ animation: "mm-bob 2.4s ease-in-out infinite" }} />
        </div>
        <span className="t-d2" style={{ color: "var(--m-forest-2)" }}>Order placed!</span>
        <span className="t-body-soft" style={{ maxWidth: 280 }}>
          Bo will nudge you here as it&rsquo;s shopped and delivered. Your stomach just applauded.
        </span>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <span className="t-h2">Your order</span>
          <span className="chip-tag chip">Confirmed</span>
        </div>
        {/* Dots and connectors are FLAT SIBLINGS, as in the artboard. Nesting
            each connector inside its step's column makes the columns unequal
            widths and the track visibly crooked. */}
        <div className="hstack" style={{ gap: 0, alignItems: "flex-start" }}>
          {STEPS.map((label, i) => {
            const done = i <= REACHED;
            return (
              <Fragment key={label}>
                {i > 0 && (
                  <i style={{ flex: 0.7, height: 3, marginTop: 12, background: i <= REACHED ? "var(--m-lime)" : "var(--m-ink-faint)" }} />
                )}
                <div className="vstack" style={{ flex: 1, alignItems: "center", gap: 5, minWidth: 0 }}>
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      flex: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: done ? "var(--m-lime)" : "var(--m-cream-2)",
                    }}
                  >
                    {done && <Check width={14} height={14} style={{ color: "var(--m-forest-2)" }} />}
                  </span>
                  <span className="t-micro" style={{ textAlign: "center", lineHeight: 1.15, ...(done ? { color: "var(--m-forest)" } : {}) }}>
                    {label}
                  </span>
                </div>
              </Fragment>
            );
          })}
        </div>
        {/* Says plainly that the later steps are not being tracked live. */}
        <span className="t-cap" style={{ display: "block", marginTop: 10 }}>
          Updates arrive as notifications — this screen does not track the order live.
        </span>
      </div>

      <span className="t-h1">While you wait</span>

      <button className="row" onClick={() => router.push("/m/recipe")} style={{ width: "100%", textAlign: "left", border: "none" }}>
        <span className="icon-btn tint-green" style={{ boxShadow: "none", color: "var(--m-forest)", flex: "none" }}>
          <ChefHat width={20} height={20} />
        </span>
        <div className="vstack grow" style={{ gap: 0, minWidth: 0 }}>
          <span className="t-h2">Prep the recipe steps</span>
          <span className="t-cap">Mise en place like you mean it</span>
        </div>
        <ChevronRight width={18} height={18} style={{ color: "var(--m-ink-soft)", flex: "none" }} />
      </button>

      <button className="row" onClick={() => router.push("/m/plan")} style={{ width: "100%", textAlign: "left", border: "none" }}>
        <span className="icon-btn tint-lav" style={{ boxShadow: "none", color: "var(--m-plum)", flex: "none" }}>
          <Utensils width={20} height={20} />
        </span>
        <div className="vstack grow" style={{ gap: 0, minWidth: 0 }}>
          <span className="t-h2">Add it to this week&rsquo;s plan</span>
          <span className="t-cap">Future you says thanks</span>
        </div>
        <ChevronRight width={18} height={18} style={{ color: "var(--m-ink-soft)", flex: "none" }} />
      </button>

      <div className="grow" />

      <button className="pill-secondary" style={{ width: "100%" }} onClick={() => router.push("/m")}>Back to home</button>
    </div>
  );
}
