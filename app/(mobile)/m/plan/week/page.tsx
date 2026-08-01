"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Sparkles } from "lucide-react";
import { getMealLogs, getNutritionGoals } from "@/lib/storage";
import { dayTotals, lastNDates } from "@/lib/nutrition";
import type { MealLog, NutritionGoals } from "@/lib/types";

/**
 * Tracker sub-screen — This week (v3-screens ScreenWeeklyPlan). Weekly summary
 * + per-day calorie bars vs goal, from real meal_logs. CTA → AI diet chart.
 */
const DEFAULT_GOALS: NutritionGoals = { dailyCalories: 2000, protein: 150, carbs: 225, fat: 56, goal: "maintain" };
const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function WeeklyPlan() {
  const router = useRouter();
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [goals, setGoals] = useState<NutritionGoals>(DEFAULT_GOALS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setLogs(getMealLogs()); setGoals(getNutritionGoals() ?? DEFAULT_GOALS); setHydrated(true); }, []);

  const week = useMemo(() => lastNDates(7), []);
  const perDay = useMemo(() => week.map((d) => ({ date: d, cal: dayTotals(logs, d).calories })), [week, logs]);
  const weekTotal = perDay.reduce((s, d) => s + d.cal, 0);
  const weekTarget = goals.dailyCalories * 7;
  const onTargetPct = weekTarget > 0 ? Math.round((weekTotal / weekTarget) * 100) : 0;
  const maxBar = Math.max(goals.dailyCalories * 1.2, ...perDay.map((d) => d.cal), 1);

  if (!hydrated) return <div style={{ minHeight: "100dvh", background: "var(--m-cream)" }} />;

  return (
    <div className="col" style={{ minHeight: "100dvh", background: "var(--m-cream)" }}>
      <div className="hstack" style={{ padding: "calc(env(safe-area-inset-top,12px) + 6px) 14px 8px", gap: 8 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--m-ink)" }} aria-label="Back"><ChevronLeft width={22} height={22} /></button>
        <h1 className="t-h1">This week</h1>
      </div>

      <div className="scroll" style={{ flex: 1, padding: "8px 14px 40px" }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 14 }}>
            <div className="col">
              <span className="t-cap">LAST 7 DAYS</span>
              <span style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{weekTotal.toLocaleString()} / {weekTarget.toLocaleString()} cal</span>
              <span className="t-small" style={{ fontSize: 11, color: onTargetPct <= 105 ? "var(--m-lime)" : "var(--m-forest)" }}>● {onTargetPct}% of target</span>
            </div>
          </div>
          <div className="hstack" style={{ alignItems: "flex-end", gap: 8, height: 96, marginTop: 8 }}>
            {perDay.map((d) => {
              const h = (d.cal / maxBar) * 100;
              const over = d.cal > goals.dailyCalories;
              const dow = DOW[new Date(d.date + "T00:00:00").getDay()];
              return (
                <div key={d.date} className="col" style={{ flex: 1, alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                  <div style={{ width: "100%", height: `${Math.max(h, d.cal > 0 ? 4 : 0)}%`, minHeight: d.cal > 0 ? 4 : 0, borderRadius: 6, background: over ? "#ff453a" : "var(--m-lime)", opacity: 0.9 }} title={`${d.cal} cal`} />
                  <span className="t-cap" style={{ fontSize: 9 }}>{dow}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Diet chart CTA */}
        <div className="card" style={{ marginTop: 14, padding: 16, background: "var(--m-tint-green)", borderColor: "var(--m-tint-green)" }}>
          <div className="hstack" style={{ gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
            <div className="ai-orb" style={{ marginTop: 2 }} />
            <div className="col" style={{ flex: 1 }}>
              <span className="t-cap" style={{ color: "var(--m-forest)" }}>AI DIET CHART</span>
              <span style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>A 7-day plan, tuned to you</span>
              <span className="t-small" style={{ fontSize: 12 }}>meshi builds a week of meals from your goal + recent intake.</span>
            </div>
          </div>
          <button className="pill-primary" onClick={() => router.push("/m/plan/diet-chart")}>
            <Sparkles width={16} height={16} /> Generate diet chart
          </button>
        </div>
      </div>
    </div>
  );
}
