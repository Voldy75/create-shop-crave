"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Flame } from "lucide-react";
import { getMealLogs } from "@/lib/storage";
import { loggingStreak, localDateKey } from "@/lib/nutrition";
import { shelfFor, nextUnlock, unlockedCount, UNLOCK_LADDER, mascotLabel } from "@/lib/mascot-unlocks";
import { Leek } from "@/components/mascots";
import type { MealLog } from "@/lib/types";

/**
 * Streak & mascot unlocks — artboard 1l.
 *
 * Every number here is derived from real meal logs; nothing is seeded or
 * demonstrative. The artboard's "12 days / 5 of 12 / 2 more days to unlock
 * Mushroom" are its sample values, and a fresh account correctly renders
 * zero, an all-locked shelf, and the day-1 empty state instead.
 *
 * The ladder itself lives in lib/mascot-unlocks so the Plan tab's flame chip
 * and this screen cannot drift apart.
 */

/** Mon-first week, matching the artboard's M…S dot row. */
const WEEK_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

function thisWeekKeys(today = new Date()): string[] {
  const dow = (today.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(today.getTime() - dow * 86_400_000);
  return Array.from({ length: 7 }, (_, i) => localDateKey(new Date(monday.getTime() + i * 86_400_000)));
}

export default function StreakPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLogs(getMealLogs());
    setHydrated(true);
  }, []);

  const streak = useMemo(() => loggingStreak(logs), [logs]);
  const shelf = useMemo(() => shelfFor(streak), [streak]);
  const next = useMemo(() => nextUnlock(streak), [streak]);
  const week = useMemo(() => {
    const loggedDays = new Set(logs.map((l) => l.date));
    return thisWeekKeys().map((k) => loggedDays.has(k));
  }, [logs]);

  if (!hydrated) return <div style={{ minHeight: "100dvh", background: "var(--m-cream)" }} />;

  const NextMascot = next ? shelf.find((s) => s.name === next.entry.name)!.Component : null;

  return (
    <div
      className="vstack"
      style={{
        minHeight: "100dvh",
        background: "var(--m-cream)",
        padding: "calc(env(safe-area-inset-top, 12px) + 10px) 20px calc(env(safe-area-inset-bottom, 0px) + 24px)",
        gap: 12,
      }}
    >
      <div className="hstack">
        <button className="icon-btn" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft width={20} height={20} />
        </button>
        <span className="t-d2 grow" style={{ marginLeft: 10 }}>Your streak</span>
      </div>

      {/* Streak hero */}
      <div className="card tint-peach" style={{ boxShadow: "none", padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div className="hstack" style={{ gap: 10 }}>
          <Flame width={34} height={34} style={{ color: "var(--m-burnt)" }} />
          <span style={{ font: "800 52px/1 var(--m-font-display)", color: "var(--m-burnt)" }}>{streak}</span>
        </div>
        <span className="t-h2" style={{ color: "var(--m-brown)", textAlign: "center" }}>
          {streak === 0
            ? "No streak yet. Log a meal to light it."
            : streak === 1
              ? "day of logging. The pan is watching."
              : "days of logging. The pan respects you."}
        </span>

        {/* This calendar week, Mon–Sun. Filled = a day with at least one log. */}
        <div className="hstack" style={{ gap: 6, marginTop: 4 }}>
          {week.map((on, i) => (
            <span key={i} className="hstack" style={{ gap: 6 }}>
              {i === 0 && <span className="t-micro" style={{ color: "var(--m-burnt)" }}>M</span>}
              <i
                aria-label={`${WEEK_LETTERS[i]}${on ? " logged" : " not logged"}`}
                style={{
                  width: 9, height: 9, borderRadius: 9,
                  background: on ? "var(--m-burnt)" : "var(--m-tint-peach)",
                  boxShadow: on ? "none" : "inset 0 0 0 1.5px var(--m-ink-faint)",
                }}
              />
              {i === 6 && <span className="t-micro" style={{ color: "var(--m-burnt)" }}>S</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Shelf */}
      <div className="hstack" style={{ justifyContent: "space-between" }}>
        <span className="t-h1">Mascot shelf</span>
        <span className="t-cap">{unlockedCount(streak)} of {UNLOCK_LADDER.length}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {shelf.map(({ name, day, unlocked, Component }, i) => (
          <div
            key={name}
            className={`mascot-tile ${unlocked ? TINTS[i % TINTS.length] : "tint-cream mascot-locked"}`}
            style={{ padding: "10px 4px" }}
            title={unlocked ? `${mascotLabel(name)} — unlocked` : `${mascotLabel(name)} — day ${day}`}
          >
            <Component width={40} height={40} />
            <span className="t-micro">Day {day}</span>
          </div>
        ))}
      </div>

      {/* Next unlock */}
      {next && NextMascot && (
        <div className="card tint-lav" style={{ boxShadow: "none", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <NextMascot width={44} height={44} className="mascot-locked" style={{ flex: "none" }} />
          <div className="vstack grow" style={{ gap: 5, minWidth: 0 }}>
            <span className="t-h2" style={{ color: "var(--m-plum)" }}>
              {next.daysAway} more day{next.daysAway === 1 ? "" : "s"} to unlock {mascotLabel(next.entry.name)}
            </span>
            <div className="progress">
              <i style={{ width: `${Math.round(next.progress * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="grow" />

      <button
        onClick={() => router.push("/m/log")}
        className="toast tint-green"
        style={{ boxShadow: "none", width: "100%", border: "none", textAlign: "left" }}
      >
        <Leek width={30} height={30} style={{ flex: "none" }} />
        {streak === 0
          ? "Log your first meal to start the flame."
          : "Log dinner tonight to keep the flame alive."}
      </button>
    </div>
  );
}

/** The artboard cycles tints across unlocked tiles so the shelf isn't flat. */
const TINTS = ["tint-peach", "tint-green", "tint-lav"];
