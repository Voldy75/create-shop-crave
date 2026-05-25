"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, Sparkles, Loader2, Check } from "lucide-react";
import { getMealLogs, getNutritionGoals, saveMealPlan, type WeekPlan, type MealSlot } from "@/lib/storage";
import { lastNDates } from "@/lib/nutrition";
import { useUser } from "@/app/context/UserContext";
import type { MealLog, NutritionGoals } from "@/lib/types";

/**
 * Tracker sub-screen — AI diet chart. Calls /api/coach (mode=diet_chart) with
 * the user's recent logs + goals + dietary prefs, renders the 7-day plan, and
 * applies it to the planner (saveMealPlan), reusing the existing WeekPlan shape.
 */

interface Slot { mealType: "breakfast" | "lunch" | "dinner"; dish: string; calories: number; protein: number; carbs: number; fat: number }
interface Day { day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday"; meals: Slot[] }
interface ChartResponse { summary: string; days: Day[] }

function buildPayload(logs: MealLog[], goals: NutritionGoals, prefs: string[]) {
  const cutoff = new Set(lastNDates(7));
  return {
    mode: "diet_chart" as const,
    logs: logs.filter((l) => cutoff.has(l.date)).slice(0, 40).map((l) => ({ date: l.date, mealType: l.mealType, name: l.name, calories: l.calories, protein: l.protein, carbs: l.carbs, fat: l.fat })),
    goals: { dailyCalories: goals.dailyCalories, protein: goals.protein, carbs: goals.carbs, fat: goals.fat, goal: goals.goal },
    dietaryPreferences: prefs,
  };
}

function toSlot(s: Slot): MealSlot {
  return { dish: s.dish, recipe: { name: s.dish, description: "", ingredients: [], instructions: [], nutritionEstimate: { calories: `~${s.calories} kcal`, protein: `${s.protein}g`, carbs: `${s.carbs}g`, fat: `${s.fat}g` } } };
}

export default function DietChart() {
  const router = useRouter();
  const { dietaryPreferences } = useUser();
  const [chart, setChart] = useState<ChartResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const generate = async () => {
    const goals = getNutritionGoals();
    if (!goals) { setError("Set your goals first (in onboarding)."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPayload(getMealLogs(), goals, dietaryPreferences)) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error === "rate_limit_exceeded" ? "Daily AI limit reached." : res.status === 401 ? "Sign in to use the AI coach." : data.message || "Couldn't generate the chart.");
        return;
      }
      setChart(data as ChartResponse);
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { generate(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const apply = () => {
    if (!chart) return;
    const plan: WeekPlan = {};
    for (const d of chart.days) {
      plan[d.day] = {};
      for (const m of d.meals) plan[d.day][m.mealType] = toSlot(m);
    }
    saveMealPlan(plan);
    setApplied(true);
  };

  return (
    <div className="col" style={{ minHeight: "100dvh", background: "var(--cc-bg)" }}>
      <div className="row" style={{ padding: "calc(env(safe-area-inset-top,12px) + 6px) 14px 8px", gap: 8 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--cc-ink-1)" }} aria-label="Back"><ChevronLeft width={22} height={22} /></button>
        <h1 className="t-h1">Diet chart</h1>
      </div>

      <div className="scroll" style={{ flex: 1, padding: "8px 14px 40px" }}>
        {loading && (
          <div className="col" style={{ alignItems: "center", gap: 12, paddingTop: "30vh", color: "var(--cc-ink-2)" }}>
            <Loader2 width={28} height={28} className="animate-spin" style={{ color: "var(--cc-acc)" }} />
            <span className="t-small">Building your 7-day plan…</span>
          </div>
        )}

        {error && !loading && (
          <div className="col" style={{ alignItems: "center", gap: 14, paddingTop: "24vh", textAlign: "center" }}>
            <p className="t-body" style={{ color: "var(--cc-ink-2)", maxWidth: 280 }}>{error}</p>
            <button className="pill-primary" style={{ width: "auto", padding: "12px 22px" }} onClick={generate}>Try again</button>
          </div>
        )}

        {chart && !loading && (
          <>
            {chart.summary && (
              <div className="card" style={{ padding: 14, marginBottom: 12, background: "var(--cc-acc-soft)", borderColor: "var(--cc-acc-dim)" }}>
                <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
                  <Sparkles width={16} height={16} style={{ color: "var(--cc-acc)", flexShrink: 0, marginTop: 2 }} />
                  <span className="t-small" style={{ color: "var(--cc-ink-1)" }}>{chart.summary}</span>
                </div>
              </div>
            )}
            <div className="col" style={{ gap: 10 }}>
              {chart.days.map((d) => {
                const total = d.meals.reduce((s, m) => s + m.calories, 0);
                return (
                  <div key={d.day} className="card" style={{ padding: 14 }}>
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                      <span className="t-h3">{d.day}</span>
                      <span className="t-small">{total} cal</span>
                    </div>
                    <div className="col" style={{ gap: 6 }}>
                      {d.meals.map((m) => (
                        <div key={m.mealType} className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                          <span className="t-small" style={{ color: "var(--cc-ink-2)", textTransform: "capitalize", flex: "0 0 72px" }}>{m.mealType}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 0 }}>{m.dish}</span>
                          <span className="t-small" style={{ fontSize: 11 }}>{m.calories}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {chart && !loading && (
        <div className="glass" style={{ position: "sticky", bottom: 0, padding: "12px 16px calc(14px + env(safe-area-inset-bottom,0px))", borderTop: "1px solid var(--cc-line)" }}>
          <button className="pill-primary" onClick={apply} disabled={applied}>
            {applied ? <><Check width={16} height={16} /> Applied to your plan</> : "Apply to my planner"}
          </button>
        </div>
      )}
    </div>
  );
}
