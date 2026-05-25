"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Flame, ShoppingCart, MapPin, CalendarDays, Sparkles, ChevronRight } from "lucide-react";
import { useUser } from "@/app/context/UserContext";

/**
 * Mobile Home — recreates the intent of the Food-Kuu Home artboard using the
 * --cc-* token system (matches the web app): greeting header, an AI "craving
 * brief" hero that deep-links into chat, a 2×2 quick-action grid mapping to the
 * four core journeys, and a "pick up where you left off" rail.
 *
 * Wired to real UserContext (name, location, dietary prefs). Cards route to
 * real surfaces; the chat hero hands a seeded prompt to /m/chat.
 */

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const QUICK_ACTIONS = [
  { label: "Cook tonight", sub: "Recipe + shopping", icon: Flame, href: "/m/chat?q=" + encodeURIComponent("A quick dinner I can cook tonight") , accent: true },
  { label: "Order in", sub: "Groceries or food", icon: ShoppingCart, href: "/m/chat?agent=1&q=" + encodeURIComponent("Order dinner for tonight") },
  { label: "Eat out near me", sub: "Top spots", icon: MapPin, href: "/m/chat?q=" + encodeURIComponent("Best restaurants near me right now") },
  { label: "Plan the week", sub: "Tracker + plan", icon: CalendarDays, href: "/m/plan" },
];

export default function MobileHome() {
  const router = useRouter();
  const { userName, dietaryPreferences, hydrated } = useUser();
  const [dateLabel, setDateLabel] = useState("");

  useEffect(() => {
    setDateLabel(
      new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
    );
  }, []);

  const name = hydrated && userName ? userName.split(" ")[0] : "there";

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between" style={{ padding: "calc(env(safe-area-inset-top, 12px) + 8px) 16px 8px" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--cc-text-tertiary)" }}>
            {dateLabel}
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.02em", marginTop: "2px" }}>
            {greeting()}, {name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/m/inbox"
            className="relative grid place-items-center"
            style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--cc-surface)", border: "1px solid var(--cc-border)", color: "var(--cc-text-secondary)" }}
            aria-label="Inbox"
          >
            <Bell className="w-[18px] h-[18px]" />
          </Link>
          <Link
            href="/m/profile"
            className="grid place-items-center text-white"
            style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--cc-accent)", fontWeight: 700, fontSize: 15 }}
            aria-label="Profile"
          >
            {name.charAt(0).toUpperCase()}
          </Link>
        </div>
      </header>

      <main className="flex flex-col gap-6 px-4 pt-2">
        {/* AI craving hero */}
        <button
          onClick={() => router.push("/m/chat")}
          className="text-left relative overflow-hidden"
          style={{
            padding: 18,
            borderRadius: "22px",
            background: "linear-gradient(135deg, var(--cc-surface) 0%, var(--cc-surface-2) 100%)",
            border: "1px solid var(--cc-border)",
          }}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
            <Sparkles className="w-[18px] h-[18px]" style={{ color: "var(--cc-accent)" }} />
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--cc-text-tertiary)" }}>
              Tell me what you're craving
            </span>
          </div>
          <p style={{ fontSize: "20px", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.02em" }}>
            One chat → a recipe, the best nearby spots, or it ordered for you.
          </p>
          <span
            className="inline-flex items-center gap-1.5 text-white"
            style={{ marginTop: 14, padding: "10px 16px", borderRadius: "999px", background: "var(--cc-accent)", fontWeight: 600, fontSize: 14 }}
          >
            Start a craving <Sparkles className="w-4 h-4" />
          </span>
          <div style={{ position: "absolute", right: -30, bottom: -40, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, var(--cc-accent-dim), transparent 65%)" }} />
        </button>

        {/* Quick actions 2×2 */}
        <div className="grid grid-cols-2 gap-3">
          {QUICK_ACTIONS.map((q) => {
            const Icon = q.icon;
            return (
              <Link
                key={q.label}
                href={q.href}
                className="flex flex-col gap-2"
                style={{
                  padding: 14,
                  borderRadius: "16px",
                  background: q.accent ? "var(--cc-accent-dim)" : "var(--cc-surface)",
                  border: "1px solid var(--cc-border)",
                }}
              >
                <Icon className="w-5 h-5" style={{ color: q.accent ? "var(--cc-accent)" : "var(--cc-text-secondary)" }} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>{q.label}</span>
                <span style={{ fontSize: 11, color: "var(--cc-text-tertiary)" }}>{q.sub}</span>
              </Link>
            );
          })}
        </div>

        {/* Dietary prefs chip row (real data) */}
        {hydrated && dietaryPreferences.length > 0 && (
          <div>
            <SectionTitle>Tuned to your tastes</SectionTitle>
            <div className="flex gap-2 flex-wrap">
              {dietaryPreferences.map((p) => (
                <span
                  key={p}
                  style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: "999px", background: "var(--cc-surface-2)", color: "var(--cc-text-secondary)", border: "1px solid var(--cc-border)", textTransform: "capitalize" }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Continue rail → tracker/plan */}
        <div>
          <SectionTitle>Pick up where you left off</SectionTitle>
          <Link
            href="/m/plan"
            className="flex items-center gap-3"
            style={{ padding: 14, borderRadius: "16px", background: "var(--cc-surface)", border: "1px solid var(--cc-border)" }}
          >
            <div className="grid place-items-center" style={{ width: 52, height: 52, borderRadius: "12px", background: "var(--cc-accent-dim)", color: "var(--cc-accent)" }}>
              <CalendarDays className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div style={{ fontWeight: 700, fontSize: 15 }}>Your week & tracker</div>
              <div style={{ fontSize: 12, color: "var(--cc-text-tertiary)" }}>Log a meal, see today's calories</div>
            </div>
            <ChevronRight className="w-5 h-5" style={{ color: "var(--cc-text-tertiary)" }} />
          </Link>
        </div>
      </main>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.02em", color: "var(--cc-text-secondary)", marginBottom: 10 }}>
      {children}
    </h2>
  );
}
