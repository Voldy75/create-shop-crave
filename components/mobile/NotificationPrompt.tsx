"use client";

import { useEffect, useState } from "react";
import { Flame, Bell, Sparkles } from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import { enableWebPush, isPushSupported, pushPermission } from "@/lib/push-client";
import { BoBowl } from "@/components/mascots";

const SEEN_KEY = "crave_notifPromptSeen";

/**
 * Bottom-up notification prompt — artboard 7d.
 *
 * Deliberately narrower than the artboard's trigger condition would suggest.
 * Shown once, and only when ALL of:
 *   - signed in (there's somewhere for a subscription to attach to)
 *   - the browser supports push AND permission is still "default" (never
 *     granted or denied — re-prompting after a denial is not possible and
 *     nagging into that wall would be worse than saying nothing)
 *   - there's an actual streak (day 1 has nothing to protect yet; the
 *     artboard's own hook is "keep your streak alive")
 *   - onboarding's 2c step hasn't already asked (that flag lives in
 *     localStorage too — see onboarding's `lightTheFlame`)
 *
 * "Not now" and "Allow" both mark it seen — this is a one-shot ask, not a
 * recurring nag. Uses .sheet-scrim, which mobile.css already defines for
 * exactly this (bottom sheet over a dimmed backdrop) but had no consumer yet.
 */
export function NotificationPrompt({ streak }: { streak: number }) {
  const { user, hydrated } = useUser();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hydrated || !user || streak <= 0) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(SEEN_KEY)) return;
    if (!isPushSupported() || pushPermission() !== "default") return;

    const t = setTimeout(() => setShow(true), 1200);
    return () => clearTimeout(t);
  }, [hydrated, user, streak]);

  const dismiss = () => {
    localStorage.setItem(SEEN_KEY, "1");
    setShow(false);
  };

  const allow = async () => {
    setBusy(true);
    try {
      await enableWebPush();
    } finally {
      dismiss();
    }
  };

  if (!show) return null;

  return (
    <div className="sheet-scrim">
      <div
        className="vstack"
        style={{
          width: "100%",
          maxWidth: 520,
          background: "var(--m-cream)",
          borderRadius: "30px 30px 0 0",
          padding: "14px 26px calc(env(safe-area-inset-bottom, 0px) + 30px)",
          alignItems: "center",
          gap: 10,
          boxShadow: "0 -14px 40px rgba(30, 20, 8, .3)", // hex-ok: matches .sheet-scrim's brown-not-black depth, one-off sheet shadow not a reusable token
        }}
      >
        <span style={{ width: 44, height: 5, borderRadius: 9, background: "var(--m-ink-faint)" }} />

        <div
          className="tint-peach"
          style={{
            borderRadius: 22, width: "100%", padding: 20, display: "flex",
            justifyContent: "center", position: "relative", marginTop: 4,
          }}
        >
          <BoBowl width={72} height={72} style={{ animation: "mm-bob 2.4s ease-in-out infinite" }} />
          <span
            style={{
              position: "absolute", top: 14, left: 20, background: "var(--m-forest)",
              color: "var(--m-on-deep)", font: "800 10px var(--m-font-display)",
              padding: "4px 8px", borderRadius: 8,
            }}
          >
            Streak · Day {streak} 🔥
          </span>
        </div>

        <span className="t-d2" style={{ textAlign: "center", marginTop: 2 }}>
          Never miss Bo&rsquo;s nudges
        </span>

        <div className="vstack" style={{ gap: 10, width: "100%", marginTop: 2 }}>
          <div className="hstack" style={{ gap: 12 }}>
            <Flame width={22} height={22} style={{ color: "var(--m-burnt)", flex: "none" }} />
            <span className="t-body">Keep your streak alive with a daily reminder</span>
          </div>
          <div className="hstack" style={{ gap: 12 }}>
            <Bell width={22} height={22} style={{ color: "var(--m-forest)", flex: "none" }} />
            <span className="t-body">Live order &amp; delivery updates</span>
          </div>
          <div className="hstack" style={{ gap: 12 }}>
            <Sparkles width={22} height={22} style={{ color: "var(--m-plum)", flex: "none" }} />
            <span className="t-body">Dinner ideas the moment you&rsquo;re hungry</span>
          </div>
        </div>

        <button className="pill-primary pill-attn" style={{ width: "100%", marginTop: 8 }} onClick={allow} disabled={busy}>
          {busy ? "One sec…" : "Allow notifications"}
        </button>
        <button className="t-cap" onClick={dismiss} style={{ background: "none", border: "none" }}>
          Not now
        </button>
      </div>
    </div>
  );
}
