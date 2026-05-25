"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Flame, ShoppingCart, MapPin, CalendarRange, Sparkles, ChevronRight } from "lucide-react";
import { useUser } from "@/app/context/UserContext";

/**
 * Food-Kuu Home — faithful to the handoff Home artboard (assets/screens-core.jsx)
 * recreated with the --fk-* system: greeting header, dark "Tonight's brief" AI
 * hero, 2×2 quick-action grid, "Cravings nearby" carousel, "Pick up where you
 * left off", "Curated for you". Wired to real UserContext where it makes sense.
 */

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

const QUICK = [
  { l: "Cook tonight", s: "Recipe + shopping", Icon: Flame, soft: "var(--fk-saffron-soft)", fg: "var(--fk-saffron-deep)", href: "/m/chat?q=" + encodeURIComponent("A quick dinner I can cook tonight") },
  { l: "Order in", s: "Groceries or food", Icon: ShoppingCart, soft: "var(--fk-sage-soft)", fg: "var(--fk-sage)", href: "/m/chat?agent=1&q=" + encodeURIComponent("Order dinner for tonight") },
  { l: "Eat out near me", s: "Top spots", Icon: MapPin, soft: "var(--fk-card)", fg: "var(--fk-ink)", href: "/m/chat?q=" + encodeURIComponent("Best restaurants near me right now") },
  { l: "Plan the week", s: "Tracker + plan", Icon: CalendarRange, soft: "var(--fk-card)", fg: "var(--fk-ink)", href: "/m/plan" },
];

const CRAVINGS = [
  { name: "Khao Soi", from: "Northern Thai", dist: "0.6 km", ph: "fk-photo-deep" },
  { name: "Tonkotsu Ramen", from: "Late night", dist: "1.1 km", ph: "fk-photo-cream" },
  { name: "Phở Bò", from: "Brothy", dist: "1.4 km", ph: "fk-photo-sage" },
];

export default function MobileHome() {
  const router = useRouter();
  const { userName, dietaryPreferences, location, hydrated } = useUser();
  const [dateLabel, setDateLabel] = useState("");

  useEffect(() => {
    setDateLabel(new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }));
  }, []);

  const name = hydrated && userName ? userName.split(" ")[0] : "there";
  const place = location ? "Near you" : "Set your location";

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between" style={{ padding: "calc(env(safe-area-inset-top, 12px) + 10px) 16px 4px" }}>
        <div>
          <div className="fk-cap">{dateLabel} · {place}</div>
          <div className="fk-h2" style={{ marginTop: 2 }}>{greeting()}, {name}</div>
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          <Link href="/m/inbox" aria-label="Inbox" className="relative grid place-items-center" style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--fk-card)", border: "1px solid var(--fk-line)", color: "var(--fk-ink-2)" }}>
            <Bell width={18} height={18} />
            <span style={{ position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: "50%", background: "var(--fk-saffron)" }} />
          </Link>
          <Link href="/m/profile" aria-label="Profile" className="grid place-items-center" style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--fk-saffron)", color: "#fff", fontWeight: 700 }}>
            {name.charAt(0).toUpperCase()}
          </Link>
        </div>
      </header>

      <div className="fk-scroll flex flex-col" style={{ flex: 1 }}>
        {/* AI craving hero */}
        <div style={{ padding: "12px 16px 0" }}>
          <button
            onClick={() => router.push("/m/chat")}
            className="text-left relative overflow-hidden"
            style={{ width: "100%", padding: 18, background: "var(--fk-ink)", color: "var(--fk-bg)", border: "none", borderRadius: "var(--fk-r-xl)" }}
          >
            <div className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: "conic-gradient(from 200deg, #FF6B35, #FFB07A, #4F7B5F, #FF6B35)", display: "inline-block" }} />
              <span className="fk-cap" style={{ color: "rgba(255,248,240,0.6)" }}>Tonight&apos;s brief</span>
            </div>
            <h2 className="fk-display-m" style={{ color: "var(--fk-bg)" }}>
              What are you <span style={{ fontStyle: "italic", color: "var(--fk-saffron)" }}>craving</span> right now?
            </h2>
            <span className="flex items-center" style={{ width: "fit-content", marginTop: 14, padding: "12px 16px", borderRadius: "var(--fk-r-pill)", background: "var(--fk-saffron)", color: "#fff", fontWeight: 600, gap: 8 }}>
              Start a craving <Sparkles width={16} height={16} />
            </span>
            <div style={{ position: "absolute", right: -20, bottom: -30, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,53,0.4), transparent 60%)" }} />
          </button>
        </div>

        {/* Quick actions */}
        <div style={{ padding: "14px 16px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {QUICK.map((q) => (
            <Link key={q.l} href={q.href} style={{ background: q.soft, padding: 14, borderRadius: "var(--fk-r-lg)", border: "1px solid var(--fk-line)", display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: q.fg }}><q.Icon width={20} height={20} /></span>
              <span style={{ fontWeight: 700, color: "var(--fk-ink)" }}>{q.l}</span>
              <span style={{ fontSize: 11, color: "var(--fk-ink-3)" }}>{q.s}</span>
            </Link>
          ))}
        </div>

        {/* Cravings nearby */}
        <Sec title="Cravings nearby" action="See all">
          <div className="fk-scroll" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
            {CRAVINGS.map((c) => (
              <Link key={c.name} href={"/m/chat?q=" + encodeURIComponent(c.name)} style={{ width: 200, flexShrink: 0 }}>
                <div className={`fk-photo ${c.ph}`} data-label={c.name} style={{ height: 170, borderRadius: "var(--fk-r-lg)" }} />
                <div style={{ marginTop: 8 }}>
                  <div className="flex items-baseline justify-between">
                    <div className="fk-h3">{c.name}</div>
                    <div style={{ fontSize: 11, color: "var(--fk-ink-3)" }}>{c.dist}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--fk-ink-2)" }}>{c.from}</div>
                </div>
              </Link>
            ))}
          </div>
        </Sec>

        {/* Tuned to tastes (real) */}
        {hydrated && dietaryPreferences.length > 0 && (
          <Sec title="Tuned to your tastes">
            <div className="flex flex-wrap" style={{ gap: 8 }}>
              {dietaryPreferences.map((p) => (
                <span key={p} className="fk-chip fk-chip-saffron" style={{ textTransform: "capitalize" }}>{p}</span>
              ))}
            </div>
          </Sec>
        )}

        {/* Pick up where you left off */}
        <Sec title="Pick up where you left off">
          <Link href="/m/plan" className="fk-card-el flex items-center" style={{ padding: 14, gap: 12 }}>
            <div className="grid place-items-center" style={{ width: 56, height: 56, borderRadius: "var(--fk-r)", background: "var(--fk-saffron-soft)", color: "var(--fk-saffron-deep)" }}>
              <CalendarRange width={24} height={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="fk-h3">Your week &amp; tracker</div>
              <div style={{ fontSize: 12, color: "var(--fk-ink-3)" }}>Log a meal · see today&apos;s calories</div>
            </div>
            <ChevronRight width={18} height={18} style={{ color: "var(--fk-ink-3)" }} />
          </Link>
        </Sec>

        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

function Sec({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "0 16px", marginTop: 22 }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 12 }}>
        <h3 className="fk-h2">{title}</h3>
        {action && <span className="fk-cap" style={{ color: "var(--fk-saffron)" }}>{action}</span>}
      </div>
      {children}
    </div>
  );
}
