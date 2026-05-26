"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sparkles, MapPin, ShoppingCart, CalendarDays, Search as SearchIcon, Flame, RotateCcw } from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import { getMealLogs } from "@/lib/storage";
import { loggingStreak } from "@/lib/nutrition";

/**
 * meshi Home — faithful to the handoff ScreenHome (v2-screens.jsx) in the
 * --cc-* black-first system: greeting + "What's it gonna be tonight?" display,
 * a saffron "Tonight's brief" card with Cook it / Order it, a 2×2 quick-action
 * grid, a cravings carousel, and an editor's-picks list. Wired to real
 * UserContext where it makes sense; cards deep-link into the real surfaces.
 */

const QUICK = [
  { Icon: Sparkles, t: "Chat", s: "Ask anything", href: "/m/chat" },
  { Icon: MapPin, t: "Near me", s: "Top spots", href: "/m/chat?q=" + encodeURIComponent("Best restaurants near me right now") },
  { Icon: ShoppingCart, t: "Order", s: "Groceries or food", href: "/m/chat?agent=1&q=" + encodeURIComponent("Order dinner for tonight") },
  { Icon: CalendarDays, t: "This week", s: "Plan & track", href: "/m/plan" },
];

const CRAVINGS = [
  { l: "Comfort", cls: "ph-saffron", n: "Butter Chicken" },
  { l: "Healthy", cls: "ph-spinach", n: "Buddha Bowl" },
  { l: "Quick", cls: "ph-fire", n: "Maggi Hacks" },
  { l: "Sweet", cls: "ph-rose", n: "Pavlova" },
];

const PICKS = [
  { n: "Five 20-minute dinners", s: "5 recipes · serves 2", cls: "ph-cream" },
  { n: "Best biryani near you", s: "8 spots · 4.6 avg", cls: "ph-saffron" },
  { n: "Late-night soul food", s: "Open past midnight", cls: "ph-night" },
];

export default function MeshiHome() {
  const router = useRouter();
  const { userName, hydrated } = useUser();
  const [timeLabel, setTimeLabel] = useState("");
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const d = new Date();
    setTimeLabel(
      d.toLocaleDateString(undefined, { weekday: "long" }) +
        " · " +
        d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
    );
    setStreak(loggingStreak(getMealLogs()));
  }, []);

  const initials = hydrated && userName ? userName.slice(0, 2).toUpperCase() : "··";

  return (
    <div className="col" style={{ height: "100%", background: "var(--cc-bg)" }}>
      <div className="scroll" style={{ flex: 1 }}>
        {/* Header */}
        <div style={{ padding: "calc(env(safe-area-inset-top, 12px) + 8px) 18px 4px" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div className="col">
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                <span className="t-cap" style={{ color: "var(--cc-acc)" }}>{timeLabel}</span>
                {streak > 0 && (
                  <Link
                    href="/m/plan"
                    className="row"
                    aria-label={`${streak} day logging streak`}
                    style={{ gap: 3, alignItems: "center", textDecoration: "none", background: "var(--cc-acc-dim)", color: "var(--cc-acc)", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}
                  >
                    <Flame width={12} height={12} /> {streak}
                  </Link>
                )}
              </div>
              <h1 className="t-display" style={{ marginTop: 4 }}>
                What&apos;s it gonna<br />be tonight?
              </h1>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <Link href="/m/search" aria-label="Search" style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--cc-surf-3)", display: "grid", placeItems: "center", color: "var(--cc-ink-1)", textDecoration: "none" }}>
                <SearchIcon width={18} height={18} />
              </Link>
              <Link
                href="/m/profile"
                style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--cc-surf-3)", display: "grid", placeItems: "center", color: "var(--cc-ink-1)", fontWeight: 700, fontSize: 14, textDecoration: "none" }}
              >
                {initials}
              </Link>
            </div>
          </div>
        </div>

        {/* Tonight's brief */}
        <div style={{ padding: 18 }}>
          <div className="card-acc" style={{ padding: 20, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, opacity: 0.18, background: "radial-gradient(80% 80% at 80% 0%, #fff, transparent 60%)" }} />
            <div className="row" style={{ gap: 8, marginBottom: 12, position: "relative" }}>
              <span className="ai-orb" style={{ background: "rgba(255,255,255,0.95)" }} />
              <span className="t-cap" style={{ color: "rgba(255,255,255,0.85)" }}>Tonight&apos;s brief</span>
            </div>
            <p className="t-h2" style={{ position: "relative", lineHeight: 1.3, fontWeight: 500 }}>
              Tell meshi what you&apos;re craving — get a recipe, the best nearby spots, or have it ordered for you.
            </p>
            <div className="row" style={{ gap: 8, marginTop: 16, position: "relative" }}>
              <button
                onClick={() => router.push("/m/chat?q=" + encodeURIComponent("What should I cook tonight?"))}
                className="pill-tonal"
                style={{ background: "rgba(255,255,255,0.18)", color: "#fff", flex: 1, padding: "10px 14px", fontSize: 13 }}
              >
                Cook it
              </button>
              <button
                onClick={() => router.push("/m/chat?agent=1&q=" + encodeURIComponent("Order dinner for tonight"))}
                className="pill-tonal"
                style={{ background: "#fff", color: "var(--cc-acc-deep)", flex: 1, padding: "10px 14px", fontSize: 13, fontWeight: 600 }}
              >
                Order it
              </button>
            </div>
          </div>
        </div>

        {/* 1-tap reorder — hands the agent the user's Instamart go-to items */}
        <div style={{ padding: "0 18px 4px" }}>
          <button
            onClick={() => router.push("/m/chat?agent=1&q=" + encodeURIComponent("Reorder my usual groceries from Swiggy Instamart using my go-to items. Confirm the cart before placing."))}
            className="card row"
            style={{ padding: 12, gap: 12, width: "100%", textAlign: "left" }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--cc-acc-dim)", color: "var(--cc-acc)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <RotateCcw width={20} height={20} />
            </div>
            <div className="col" style={{ flex: 1, gap: 2, minWidth: 0 }}>
              <span className="t-h3">Order again</span>
              <span className="t-small">Reorder your go-to groceries on Instamart</span>
            </div>
          </button>
        </div>

        {/* Quick actions */}
        <div style={{ padding: "0 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {QUICK.map((q) => (
            <Link key={q.t} href={q.href} className="card" style={{ padding: 14, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, textDecoration: "none" }}>
              <q.Icon width={20} height={20} style={{ color: "var(--cc-acc)" }} />
              <div className="col" style={{ gap: 2 }}>
                <span className="t-h3">{q.t}</span>
                <span className="t-small">{q.s}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Cravings carousel */}
        <Section title="Cravings, right now">
          <div className="hscroll row" style={{ gap: 10, padding: "0 18px" }}>
            {CRAVINGS.map((c) => (
              <Link
                key={c.n}
                href={"/m/chat?q=" + encodeURIComponent(c.n)}
                className="ph"
                style={{ width: 150, height: 200, borderRadius: "var(--cc-r-lg)", flexShrink: 0, position: "relative", overflow: "hidden", textDecoration: "none" }}
              >
                <div className={`ph ${c.cls}`} style={{ position: "absolute", inset: 0 }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.7) 100%)" }} />
                <div style={{ position: "absolute", left: 12, top: 12 }}>
                  <span className="chip" style={{ background: "rgba(0,0,0,0.5)", color: "#fff", borderColor: "rgba(255,255,255,0.2)", fontSize: 10, padding: "4px 9px" }}>{c.l}</span>
                </div>
                <div style={{ position: "absolute", left: 12, right: 12, bottom: 12, color: "#fff" }}>
                  <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>{c.n}</div>
                </div>
              </Link>
            ))}
          </div>
        </Section>

        {/* Editor's picks */}
        <Section title="Editor's picks" action="See all">
          <div className="col" style={{ gap: 10, padding: "0 18px" }}>
            {PICKS.map((e) => (
              <div key={e.n} className="card row" style={{ padding: 10, gap: 12 }}>
                <div className={`ph ${e.cls}`} style={{ width: 64, height: 64, borderRadius: "var(--cc-r-md)", flexShrink: 0 }} />
                <div className="col" style={{ gap: 3 }}>
                  <span className="t-h3">{e.n}</span>
                  <span className="t-small">{e.s}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", padding: "0 18px", marginBottom: 12 }}>
        <h3 className="t-h2">{title}</h3>
        {action && <span className="t-cap" style={{ color: "var(--cc-acc)" }}>{action}</span>}
      </div>
      {children}
    </div>
  );
}
