"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getMealLogs, getMealPlan, getNutritionGoals, type WeekPlan } from "@/lib/storage";
import { dayTotals, lastNDates, localDateKey } from "@/lib/nutrition";
import { mascotComponentFor } from "@/lib/ingredient-mascot";
import type { MealLog, NutritionGoals } from "@/lib/types";

/**
 * Week view — built to the Flow 6 artboard (1k).
 *
 * The artboard's bar chart is chunky and colour-coded by outcome: lime on
 * target, orange over, forest for today, faint for a day with nothing logged.
 * That replaces the thin uniform lime bars, which said nothing about how the
 * day actually went.
 *
 * Below the chart the artboard previews Bo's diet chart. We only show real
 * rows — the plan the user has already applied (lib/storage getMealPlan). With
 * no plan saved there is nothing truthful to preview, so the CTA takes its
 * place instead of four invented days.
 */

const DEFAULT_GOALS: NutritionGoals = { dailyCalories: 2000, protein: 150, carbs: 225, fat: 56, goal: "maintain" };
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** getMealPlan is keyed by full weekday name. */
const PLAN_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export default function WeeklyPlan() {
  const router = useRouter();
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [goals, setGoals] = useState<NutritionGoals>(DEFAULT_GOALS);
  const [plan, setPlan] = useState<WeekPlan>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLogs(getMealLogs());
    setGoals(getNutritionGoals() ?? DEFAULT_GOALS);
    setPlan(getMealPlan());
    setHydrated(true);
  }, []);

  const week = useMemo(() => lastNDates(7), []);
  const today = useMemo(() => localDateKey(), []);
  const perDay = useMemo(() => week.map((d) => ({ date: d, cal: dayTotals(logs, d).calories })), [week, logs]);

  const logged = perDay.filter((d) => d.cal > 0);
  const avg = logged.length ? Math.round(logged.reduce((s, d) => s + d.cal, 0) / logged.length) : 0;
  const onTrack = avg > 0 && avg <= goals.dailyCalories;
  /* Scale so a day that exactly hits the goal fills the chart — bar height then
     reads as "how close to target", and a bar that overshoots visibly breaks
     the line. Scaling to the tallest bar instead would make any week look the
     same shape regardless of the goal. */
  const maxBar = Math.max(goals.dailyCalories, ...perDay.map((d) => d.cal), 1);

  const planned = PLAN_DAYS.flatMap((d) => {
    const slots = plan[d];
    const dinner = slots?.dinner ?? slots?.lunch ?? slots?.breakfast;
    return dinner ? [{ day: d, dish: dinner.dish }] : [];
  });

  if (!hydrated) return <div style={{ minHeight: "100dvh", background: "var(--m-cream)" }} />;

  return (
    <div className="vstack" style={{ minHeight: "100dvh", background: "var(--m-cream)", padding: "calc(env(safe-area-inset-top, 12px) + 8px) 20px 30px", gap: 14 }}>
      <div className="hstack">
        <button className="icon-btn" onClick={() => router.back()} aria-label="Back"><ArrowLeft width={20} height={20} /></button>
        <span className="t-h1 grow" style={{ textAlign: "center", marginRight: 42 }}>This week</span>
      </div>

      {/* Calories per day */}
      <div className="card" style={{ padding: "18px 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: 130, padding: "0 4px" }}>
          {perDay.map((d) => {
            const isToday = d.date === today;
            const over = d.cal > goals.dailyCalories;
            const empty = d.cal === 0;
            const h = empty ? 30 : Math.max(30, (d.cal / maxBar) * 130);
            return (
              <div key={d.date} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <i
                  title={`${d.cal.toLocaleString()} kcal`}
                  style={{
                    width: 26,
                    height: h,
                    borderRadius: 9,
                    background: empty
                      ? "var(--m-ink-faint)"
                      : over
                        ? "var(--m-orange)"
                        : isToday
                          ? "var(--m-forest)"
                          : "var(--m-lime)",
                  }}
                />
                <span className="t-micro" style={{ color: isToday ? "var(--m-forest)" : undefined }}>
                  {DOW[new Date(d.date + "T00:00:00").getDay()]}
                </span>
              </div>
            );
          })}
        </div>
        <div className="hstack" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 10, padding: "0 4px" }}>
          {/* The second line names how many days the average covers —
              averaging 3 logged days across a 7-day chart is otherwise a
              quietly misleading number. */}
          <div className="vstack" style={{ gap: 1, minWidth: 0 }}>
            <span className="t-cap">
              {avg > 0 ? `Avg ${avg.toLocaleString()} kcal · goal ${goals.dailyCalories.toLocaleString()}` : "Nothing logged this week"}
            </span>
            {avg > 0 && (
              <span className="t-cap">{logged.length} of 7 days logged</span>
            )}
          </div>
          {avg > 0 && (
            <span
              className="chip-tag chip"
              style={onTrack ? { flex: "none" } : { flex: "none", background: "var(--m-tint-peach)", color: "var(--m-burnt)" }}
            >
              {onTrack ? "On track" : "Over"}
            </span>
          )}
        </div>
      </div>

      {/* Bo's diet chart */}
      <div className="hstack" style={{ justifyContent: "space-between" }}>
        <span className="t-h1">Bo&rsquo;s 7-day diet chart</span>
        <span className="chip-tag chip" style={{ background: "var(--m-tint-lav)", color: "var(--m-plum)", gap: 4 }}>
          <Sparkles width={13} height={13} /> AI
        </span>
      </div>

      {planned.length > 0 ? (
        <>
          {planned.slice(0, 4).map((p, i) => {
            const Mascot = mascotComponentFor(p.dish);
            return (
              <div key={p.day} className={`row ${i === 0 ? "tint-green" : ""}`} style={i === 0 ? { boxShadow: "none" } : undefined}>
                <span className="t-micro" style={{ width: 34, flex: "none", color: i === 0 ? "var(--m-forest)" : undefined }}>
                  {p.day.slice(0, 3)}
                </span>
                <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
                  <span className="t-h2" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.dish}</span>
                  <span className="t-cap">Dinner focus</span>
                </div>
                <Mascot width={30} height={30} style={{ flex: "none" }} />
              </div>
            );
          })}
          <div className="grow" />
          <button className="pill-secondary" style={{ width: "100%" }} onClick={() => router.push("/m/plan/diet-chart")}>
            Regenerate chart
          </button>
        </>
      ) : (
        <>
          <div className="card tint-lav" style={{ boxShadow: "none", padding: "14px 16px" }}>
            <span className="t-body">A 7-day plan tuned to your goal and what you have actually been eating.</span>
          </div>
          <div className="grow" />
          <button className="pill-primary" style={{ width: "100%" }} onClick={() => router.push("/m/plan/diet-chart")}>
            <Sparkles width={16} height={16} /> Generate diet chart
          </button>
        </>
      )}
    </div>
  );
}
