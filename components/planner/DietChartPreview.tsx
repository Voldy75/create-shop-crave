"use client";

import React, { useMemo, useState } from "react";
import { X, Check, Layers, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { WeekPlan, MealSlot } from "@/lib/storage";
import type { Ingredient } from "@/lib/types";
import {
  fetchBatchIngredients,
  lookupIngredients,
  IngredientsFetchError,
} from "@/lib/ingredients-client";

export interface GeneratedSlot {
  mealType: "breakfast" | "lunch" | "dinner";
  dish: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface GeneratedDay {
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  meals: GeneratedSlot[];
}

interface Props {
  open: boolean;
  summary: string;
  days: GeneratedDay[];
  currentPlan: WeekPlan;
  onClose: () => void;
  onApply: (plan: WeekPlan, mode: "overwrite" | "merge") => void;
  /** Used by the ingredient batch fetch to respect the user's diet. */
  dietaryPreferences?: string[];
}

function toMealSlot(slot: GeneratedSlot, ingredients?: Ingredient[]): MealSlot {
  return {
    dish: slot.dish,
    recipe: {
      name: slot.dish,
      description: "",
      ingredients: ingredients ?? [],
      instructions: [],
      nutritionEstimate: {
        calories: `~${slot.calories} kcal`,
        protein: `${slot.protein}g`,
        carbs: `${slot.carbs}g`,
        fat: `${slot.fat}g`,
      },
    },
  };
}

function buildPlan(
  days: GeneratedDay[],
  existing: WeekPlan,
  mode: "overwrite" | "merge",
  ingredientMap?: Map<string, Ingredient[]>,
): WeekPlan {
  const next: WeekPlan = mode === "merge" ? { ...existing } : {};
  for (const d of days) {
    const dayKey = d.day;
    const existingDay = mode === "merge" ? next[dayKey] ?? {} : {};
    const updatedDay: typeof existingDay = { ...existingDay };
    for (const m of d.meals) {
      if (mode === "merge" && updatedDay[m.mealType]) continue; // keep existing slot
      const ingredients = ingredientMap ? lookupIngredients(ingredientMap, m.dish) : undefined;
      updatedDay[m.mealType] = toMealSlot(m, ingredients);
    }
    if (Object.keys(updatedDay).length > 0) next[dayKey] = updatedDay;
  }
  return next;
}

const DAYS_ORDER: GeneratedDay["day"][] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function DietChartPreview({ open, summary, days, currentPlan, onClose, onApply, dietaryPreferences }: Props) {
  const [conflictMode, setConflictMode] = useState<"overwrite" | "merge">("merge");
  const [applying, setApplying] = useState(false);

  const orderedDays = useMemo(() => {
    const map = new Map(days.map((d) => [d.day, d]));
    return DAYS_ORDER.map((d) => map.get(d)).filter(Boolean) as GeneratedDay[];
  }, [days]);

  const dayTotals = (d: GeneratedDay) =>
    d.meals.reduce(
      (acc, m) => ({
        cal: acc.cal + m.calories,
        p: acc.p + m.protein,
        c: acc.c + m.carbs,
        f: acc.f + m.fat,
      }),
      { cal: 0, p: 0, c: 0, f: 0 },
    );

  const hasExisting = Object.keys(currentPlan).length > 0;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "color-mix(in srgb, var(--m-forest-2) 55%, transparent)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto"
        style={{
          background: "var(--cc-surface)",
          borderRadius: "20px 20px 0 0",
          border: "1px solid var(--cc-border)",
        }}
      >
        <div
          className="sticky top-0 flex items-start justify-between px-5 py-4 z-10"
          style={{ background: "var(--cc-surface)", borderBottom: "1px solid var(--cc-border)" }}
        >
          <div>
            <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--cc-text-primary)" }}>
              Your 7-day plan
            </h2>
            <p style={{ fontSize: "12px", color: "var(--cc-text-tertiary)", marginTop: "4px", lineHeight: 1.4 }}>
              {summary}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full"
            style={{ color: "var(--cc-text-tertiary)", background: "var(--cc-surface-2)" }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {orderedDays.map((d) => {
            const totals = dayTotals(d);
            return (
              <div
                key={d.day}
                className="p-4"
                style={{
                  background: "var(--cc-surface-2)",
                  border: "1px solid var(--cc-border)",
                  borderRadius: "12px",
                }}
              >
                <div className="flex items-baseline justify-between" style={{ marginBottom: "8px" }}>
                  <h3 style={{ fontSize: "13px", fontWeight: 700, color: "var(--cc-text-primary)" }}>
                    {d.day}
                  </h3>
                  <span style={{ fontSize: "11px", color: "var(--cc-text-tertiary)" }}>
                    {totals.cal} kcal · {totals.p}P · {totals.c}C · {totals.f}F
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {d.meals.map((m) => (
                    <div
                      key={m.mealType}
                      className="p-3"
                      style={{
                        background: "var(--cc-surface)",
                        border: "1px solid var(--cc-border)",
                        borderRadius: "10px",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          color: "var(--cc-text-tertiary)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {m.mealType}
                      </p>
                      <p
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--cc-text-primary)",
                          marginTop: "2px",
                          lineHeight: 1.3,
                        }}
                      >
                        {m.dish}
                      </p>
                      <p style={{ fontSize: "10px", color: "var(--cc-text-tertiary)", marginTop: "4px" }}>
                        {m.calories} kcal
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="sticky bottom-0 px-5 py-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between"
          style={{ background: "var(--cc-surface)", borderTop: "1px solid var(--cc-border)" }}
        >
          {hasExisting && (
            <div className="flex items-center gap-2" style={{ fontSize: "11px", color: "var(--cc-text-secondary)" }}>
              <Layers className="w-3.5 h-3.5" />
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={conflictMode === "merge"}
                  onChange={() => setConflictMode("merge")}
                />
                Merge (keep existing)
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={conflictMode === "overwrite"}
                  onChange={() => setConflictMode("overwrite")}
                />
                Overwrite
              </label>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 transition-colors"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--cc-text-secondary)",
                borderRadius: "980px",
              }}
            >
              Cancel
            </button>
            <button
              disabled={applying}
              onClick={async () => {
                setApplying(true);
                const allDishes = orderedDays.flatMap((d) => d.meals.map((m) => m.dish));
                let ingredientMap: Map<string, Ingredient[]> | undefined;
                try {
                  const result = await fetchBatchIngredients(allDishes, dietaryPreferences);
                  ingredientMap = result.byDish;
                  if (!result.complete) {
                    // Some dishes missed but the rest are fine — proceed silently.
                    console.warn("Ingredients fetch partial:", allDishes.length - ingredientMap.size, "missing");
                  }
                } catch (e) {
                  const err = e as IngredientsFetchError;
                  const msg =
                    err.code === "rate_limit_exceeded"
                      ? "AI quota reached — applying plan without ingredient details."
                      : "Couldn't fetch ingredients — applying plan with dish names only.";
                  toast(msg);
                }
                const next = buildPlan(orderedDays, currentPlan, conflictMode, ingredientMap);
                onApply(next, conflictMode);
                setApplying(false);
                onClose();
              }}
              className="flex items-center gap-1.5 px-5 py-2 text-white transition-colors"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                background: applying ? "var(--cc-surface-2)" : "var(--cc-accent)",
                color: applying ? "var(--cc-text-tertiary)" : "var(--m-on-deep)",
                borderRadius: "980px",
                cursor: applying ? "not-allowed" : "pointer",
              }}
            >
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Preparing ingredients…
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Apply to Planner
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
