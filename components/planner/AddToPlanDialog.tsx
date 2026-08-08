"use client";

import React, { useState } from "react";
import { X, Check } from "lucide-react";
import type { RecipeData } from "@/lib/types";
import { getMealPlan, saveMealPlan, type MealSlot } from "@/lib/storage";

interface Props {
  open: boolean;
  recipe: RecipeData;
  onClose: () => void;
  onAdded?: () => void;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
type MealType = (typeof MEAL_TYPES)[number];

function todayDayName(): string {
  return DAYS[(new Date().getDay() + 6) % 7]; // Mon=0 ... Sun=6
}

function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

export function AddToPlanDialog({ open, recipe, onClose, onAdded }: Props) {
  const [day, setDay] = useState<string>(todayDayName);
  const [mealType, setMealType] = useState<MealType>(defaultMealType);

  if (!open) return null;

  const plan = typeof window === "undefined" ? {} : getMealPlan();
  const existing = plan[day]?.[mealType as keyof (typeof plan)[string]];

  const handleAdd = () => {
    const next = { ...plan };
    if (!next[day]) next[day] = {};
    const slot: MealSlot = { dish: recipe.name, recipe };
    next[day][mealType as keyof (typeof next)[string]] = slot;
    saveMealPlan(next);
    onAdded?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "color-mix(in srgb, var(--m-forest-2) 55%, transparent)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md"
        style={{
          background: "var(--cc-surface)",
          borderRadius: "20px 20px 0 0",
          border: "1px solid var(--cc-border)",
        }}
      >
        <div
          className="flex items-start justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--cc-border)" }}
        >
          <div className="min-w-0 pr-2">
            <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--cc-text-primary)" }}>
              Add to plan
            </h2>
            <p
              style={{
                fontSize: "12px",
                color: "var(--cc-text-tertiary)",
                marginTop: "2px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {recipe.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full flex-shrink-0"
            style={{ color: "var(--cc-text-tertiary)", background: "var(--cc-surface-2)" }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-5">
          <Field label="Day">
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDay(d)}
                  className="py-2 transition-colors"
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    background: day === d ? "var(--cc-accent)" : "var(--cc-surface-2)",
                    color: day === d ? "var(--m-on-deep)" : "var(--cc-text-secondary)",
                    border: day === d ? "1px solid var(--cc-accent)" : "1px solid var(--cc-border)",
                    borderRadius: "8px",
                  }}
                >
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Meal">
            <div className="flex gap-2 flex-wrap">
              {MEAL_TYPES.map((mt) => (
                <button
                  key={mt}
                  onClick={() => setMealType(mt)}
                  className="px-3 py-1.5 transition-colors capitalize"
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    background: mealType === mt ? "var(--cc-accent)" : "var(--cc-surface-2)",
                    color: mealType === mt ? "var(--m-on-deep)" : "var(--cc-text-secondary)",
                    border:
                      mealType === mt ? "1px solid var(--cc-accent)" : "1px solid var(--cc-border)",
                    borderRadius: "980px",
                  }}
                >
                  {mt}
                </button>
              ))}
            </div>
          </Field>

          {existing && (
            <div
              className="px-3 py-2.5"
              style={{
                background: "var(--m-tint-peach)",
                border: "1.5px solid color-mix(in srgb, var(--m-burnt) 32%, transparent)",
                borderRadius: "10px",
                color: "var(--cc-text-secondary)",
                fontSize: "12px",
              }}
            >
              Replaces <strong style={{ color: "var(--cc-text-primary)" }}>{existing.dish}</strong> in this slot.
            </div>
          )}
        </div>

        <div
          className="px-5 py-4 flex gap-2 justify-end"
          style={{ borderTop: "1px solid var(--cc-border)" }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2"
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
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-5 py-2 text-white"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              background: "var(--cc-accent)",
              borderRadius: "980px",
            }}
          >
            <Check className="w-4 h-4" />
            Add to {day.slice(0, 3)} {mealType}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        style={{
          fontSize: "11px",
          fontWeight: 700,
          color: "var(--cc-text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: "8px",
        }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}
