"use client";

/**
 * "Bo can order on Swiggy" — the switch under the chat's message box, and
 * the one-time card that says what turning it on means.
 *
 * Off: Bo chats — recipes, ideas, places. On: Bo is the user's food agent —
 * it decides cook / order / dine-in, builds the Swiggy cart or finds a table,
 * and stops at an Approval card for every order and booking. Turning it on
 * needs a Swiggy connection, checked here so the user is pointed at Connect
 * instead of failing on their first message.
 *
 * meshi-b classes and tokens only: both root layouts render this.
 */

import { useId, useState } from "react";
import { ShieldCheck, ShoppingBag, Sparkles } from "lucide-react";
import { BoBowl } from "@/components/mascots";
import { getSwiggyStatus } from "@/lib/swiggy-client";

export function AgentSwitch({
  on,
  onChange,
  connectHref,
  disabled,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  /** Where the user connects Swiggy on this surface (web settings / mobile connections). */
  connectHref: string;
  disabled?: boolean;
}) {
  const labelId = useId();
  const hintId = useId();
  const [checking, setChecking] = useState(false);
  const [needsSwiggy, setNeedsSwiggy] = useState(false);

  const flip = async () => {
    if (on) {
      setNeedsSwiggy(false);
      onChange(false);
      return;
    }
    setChecking(true);
    const status = await getSwiggyStatus().catch(() => null);
    setChecking(false);
    if (!status?.connected) {
      setNeedsSwiggy(true);
      return;
    }
    setNeedsSwiggy(false);
    onChange(true);
  };

  return (
    <div className="hstack" style={{ gap: 10, flexWrap: "wrap", padding: "8px 6px 0" }}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={labelId}
        aria-describedby={hintId}
        disabled={disabled || checking}
        onClick={() => void flip()}
        className="hstack"
        style={{ gap: 10, minHeight: 44, padding: 0, background: "none", border: "none", cursor: "pointer", color: "var(--m-ink)" }}
      >
        <span
          aria-hidden
          style={{
            position: "relative",
            width: 40,
            height: 24,
            flex: "none",
            borderRadius: 999,
            background: on ? "var(--figure-accent)" : "var(--m-cream-2)",
            boxShadow: on ? "none" : "inset 0 0 0 1.5px var(--m-ink-soft)",
            transition: "background .15s",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              left: on ? 19 : 3,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: on ? "var(--m-card)" : "var(--m-ink-soft)",
              transition: "left .15s",
            }}
          />
        </span>
        <span id={labelId} className="t-body" style={{ fontSize: 14 }}>
          {checking ? "Checking Swiggy…" : "Bo can order on Swiggy"}
        </span>
      </button>
      <span id={hintId} className="t-cap">
        {on ? "You approve every order and booking." : "Off: Bo suggests recipes and places."}
      </span>
      {needsSwiggy && (
        <span className="t-cap" role="status" style={{ flexBasis: "100%", color: "var(--text-burnt)" }}>
          Connect your Swiggy account first so Bo can order for you.{" "}
          <a href={connectHref} style={{ color: "inherit", fontWeight: 800 }}>
            Connect Swiggy
          </a>
        </span>
      )}
    </div>
  );
}

/** What "on" means — takes the empty chat's greeting until the user taps Got it. */
export function AgentIntro({ onDismiss }: { onDismiss: () => void }) {
  const titleId = useId();
  const points: [typeof Sparkles, string][] = [
    [Sparkles, "Tell Bo what you feel like. It decides: order in, get groceries or book a table."],
    [ShoppingBag, "It does the legwork on Swiggy — finds the food, fills your cart, shows you Swiggy’s bill."],
    [ShieldCheck, "Nothing is ordered or booked until you tap. You pay on Swiggy or in your UPI app; Bo never sees payment details."],
  ];
  return (
    <section className="card vstack" aria-labelledby={titleId} style={{ padding: "18px 20px", gap: 14, textAlign: "left", width: "100%", maxWidth: 560 }}>
      <div className="hstack" style={{ gap: 10 }}>
        <BoBowl width={36} height={36} style={{ flex: "none" }} />
        <h2 id={titleId} className="t-h2" style={{ margin: 0 }}>
          Bo is now your food agent
        </h2>
      </div>
      <ul className="vstack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 10 }}>
        {points.map(([Icon, text]) => (
          <li key={text} className="hstack t-body" style={{ gap: 10, alignItems: "flex-start", fontSize: 14 }}>
            <Icon width={18} height={18} aria-hidden style={{ flex: "none", marginTop: 1, color: "var(--figure-accent)" }} />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <div className="hstack" style={{ gap: 12, flexWrap: "wrap" }}>
        <button type="button" className="pill-primary pill-sm" onClick={onDismiss}>
          Got it
        </button>
        <span className="t-cap">Turn it off anytime to just chat.</span>
      </div>
    </section>
  );
}
