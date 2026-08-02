"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, ChevronDown } from "lucide-react";
import { getMealLogs, getNutritionGoals, saveMealPlan, type WeekPlan, type MealSlot } from "@/lib/storage";
import { lastNDates } from "@/lib/nutrition";
import { mascotComponentFor } from "@/lib/ingredient-mascot";
import { BoBowl } from "@/components/mascots";
import { useUser } from "@/app/context/UserContext";
import type { MealLog, NutritionGoals } from "@/lib/types";

/**
 * Bo's diet chart — built to the Flow 6 artboard (3g).
 *
 * The artboard is one ROW PER DAY: weekday, the day's headline dish, a calorie
 * caption, and an ingredient mascot — where the previous screen stacked seven
 * cards each listing three meals. The row is the right density for scanning a
 * week, but the per-meal detail is real data, so a row expands rather than
 * discarding it.
 *
 * The header card states what the chart was actually built from (the user's
 * goal, calorie target and dietary preferences) instead of the artboard's fixed
 * "no peanuts, no shellfish".
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

/** The day's headline: dinner is the anchor meal, per the artboard. */
function headline(d: Day): Slot | undefined {
  return d.meals.find((m) => m.mealType === "dinner") ?? d.meals[0];
}

export default function DietChart() {
  const router = useRouter();
  const { dietaryPreferences } = useUser();
  const [chart, setChart] = useState<ChartResponse | null>(null);
  const [goals, setGoals] = useState<NutritionGoals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const generate = async () => {
    const g = getNutritionGoals();
    setGoals(g);
    if (!g) { setError("Set your goals first (in onboarding)."); return; }
    setLoading(true);
    setError(null);
    setApplied(false);
    try {
      const res = await fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPayload(getMealLogs(), g, dietaryPreferences)) });
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

  /* Generate once on open. `generate` is intentionally not a dependency — it is
     recreated every render and would re-fire the AI call in a loop. */
  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="vstack" style={{ minHeight: "100dvh", background: "var(--m-cream)", padding: "calc(env(safe-area-inset-top, 12px) + 8px) 20px 30px", gap: 12 }}>
      <div className="hstack">
        <button className="icon-btn" onClick={() => router.back()} aria-label="Back"><ArrowLeft width={20} height={20} /></button>
        <span className="t-h1 grow" style={{ textAlign: "center", marginRight: 42 }}>Bo&rsquo;s diet chart</span>
      </div>

      {loading && (
        <div className="vstack" style={{ alignItems: "center", gap: 12, paddingTop: "28vh" }}>
          <BoBowl width={64} height={64} style={{ animation: "mm-bob 2.4s ease-in-out infinite" }} />
          <span className="t-body-soft">Building your 7-day plan…</span>
        </div>
      )}

      {error && !loading && (
        <div className="vstack" style={{ alignItems: "center", gap: 14, paddingTop: "24vh", textAlign: "center" }}>
          <p className="t-body-soft" style={{ maxWidth: 280 }}>{error}</p>
          <button className="pill-primary" style={{ width: "auto", padding: "0 22px" }} onClick={generate}>Try again</button>
        </div>
      )}

      {chart && !loading && (
        <>
          {/* What the chart was actually built from */}
          <div className="card tint-lav hstack" style={{ boxShadow: "none", padding: "12px 16px", gap: 12 }}>
            <BoBowl width={38} height={38} style={{ flex: "none" }} />
            <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
              <span className="t-h2" style={{ color: "var(--m-plum)" }}>
                Built for &ldquo;{goals?.goal ?? "maintain"}&rdquo;
                {goals?.dailyCalories ? ` · ${goals.dailyCalories.toLocaleString()} kcal` : ""}
              </span>
              <span className="t-cap">
                {dietaryPreferences.length > 0 ? dietaryPreferences.join(", ") : "No dietary restrictions set"}
              </span>
            </div>
          </div>

          {chart.summary && <p className="t-body-soft">{chart.summary}</p>}

          {chart.days.map((d, i) => {
            const head = headline(d);
            const total = d.meals.reduce((s, m) => s + m.calories, 0);
            const protein = Math.round(d.meals.reduce((s, m) => s + m.protein, 0));
            const Mascot = mascotComponentFor(head?.dish ?? d.day);
            const isOpen = open === d.day;
            return (
              <div key={d.day} className="vstack" style={{ gap: 6 }}>
                <button
                  onClick={() => setOpen(isOpen ? null : d.day)}
                  aria-expanded={isOpen}
                  className={`row ${i === 0 ? "tint-green" : ""}`}
                  style={{ width: "100%", textAlign: "left", border: "none", ...(i === 0 ? { boxShadow: "none" } : {}) }}
                >
                  <span className="t-micro" style={{ width: 34, flex: "none", color: i === 0 ? "var(--m-forest)" : undefined }}>
                    {d.day.slice(0, 3)}
                  </span>
                  <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
                    <span className="t-h2" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {head?.dish ?? "—"}
                    </span>
                    <span className="t-cap">{total.toLocaleString()} kcal · {protein}g protein</span>
                  </div>
                  <ChevronDown
                    width={16}
                    height={16}
                    style={{ flex: "none", color: "var(--m-ink-soft)", transform: isOpen ? "rotate(180deg)" : undefined, transition: "transform .15s ease" }}
                  />
                  <Mascot width={28} height={28} style={{ flex: "none" }} />
                </button>

                {/* The per-meal detail the row summarises */}
                {isOpen && (
                  <div className="vstack" style={{ gap: 4, padding: "0 16px 4px" }}>
                    {d.meals.map((m) => (
                      <div key={m.mealType} className="hstack" style={{ gap: 10 }}>
                        <span className="t-cap" style={{ width: 64, flex: "none", textTransform: "capitalize" }}>{m.mealType}</span>
                        <span className="t-body grow" style={{ minWidth: 0 }}>{m.dish}</span>
                        <span className="t-cap" style={{ flex: "none" }}>{m.calories}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="grow" />
          <div className="hstack" style={{ gap: 10 }}>
            <button className="pill-secondary grow" onClick={generate}>Regenerate</button>
            <button className="pill-primary grow" onClick={apply} disabled={applied}>
              {applied ? <><Check width={16} height={16} /> Added</> : "Add all to plan"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
