"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Settings } from "lucide-react";
import {
  deleteMealLog,
  getMealLogs,
  getNutritionGoals,
  saveMealLog,
  saveNutritionGoals,
  takePendingMealLog,
  type PendingMealLog,
  type WeekPlan,
} from "@/lib/storage";
import {
  dayTotals,
  lastNDates,
  localDateKey,
  logsByDay,
} from "@/lib/nutrition";
import type { MealLog, NutritionGoals } from "@/lib/types";
import { CalorieRing } from "./CalorieRing";
import { MacroBars } from "./MacroBars";
import { WeeklyChart } from "./WeeklyChart";
import { MealLogList } from "./MealLogList";
import { GoalsDialog } from "./GoalsDialog";
import { LogMealSheet } from "./LogMealSheet";

const DEFAULT_GOALS: NutritionGoals = {
  dailyCalories: 2000,
  protein: 150,
  carbs: 225,
  fat: 56,
  goal: "maintain",
};

interface Props {
  weekPlan: WeekPlan;
  isSignedIn: boolean;
  autoOpenLog?: boolean;
}

export function TrackerView({ weekPlan, isSignedIn, autoOpenLog = false }: Props) {
  const today = useMemo(() => localDateKey(), []);
  const weekDates = useMemo(() => lastNDates(7), []);
  const [hydrated, setHydrated] = useState(false);
  const [goals, setGoals] = useState<NutritionGoals | null>(null);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingPrefill, setPendingPrefill] = useState<PendingMealLog | null>(null);

  useEffect(() => {
    // localStorage hydration on mount — the setState-in-effect rule doesn't apply
    // here because we're synchronizing with an external store (localStorage), which
    // is exactly what effects are for.
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = getNutritionGoals();
    setGoals(stored ?? DEFAULT_GOALS);
    setLogs(getMealLogs());
    setHydrated(true);
    if (!stored) setGoalsOpen(true);
    if (autoOpenLog) {
      const pending = takePendingMealLog();
      if (pending) {
        setPendingPrefill(pending);
        setSheetOpen(true);
      }
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [autoOpenLog]);

  const effectiveGoals = goals ?? DEFAULT_GOALS;

  const todaysLogs = useMemo(
    () => logs.filter((l) => l.date === selectedDate),
    [logs, selectedDate],
  );
  const totals = useMemo(() => dayTotals(logs, selectedDate), [logs, selectedDate]);
  const byDay = useMemo(() => logsByDay(logs, weekDates), [logs, weekDates]);

  const handleSaveLog = (input: Omit<MealLog, "id" | "loggedAt">) => {
    const saved = saveMealLog(input);
    setLogs((prev) => [saved, ...prev]);
  };

  const handleDelete = (id: string) => {
    deleteMealLog(id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSaveGoals = (next: NutritionGoals) => {
    saveNutritionGoals(next);
    setGoals(next);
  };

  if (!hydrated) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: "300px", color: "var(--cc-text-tertiary)" }}
      >
        <span style={{ fontSize: "13px" }}>Loading…</span>
      </div>
    );
  }

  const isToday = selectedDate === today;

  return (
    <div className="flex flex-col gap-6">
      {/* Top: ring + macros + actions */}
      <div
        className="p-5 sm:p-6"
        style={{
          background: "var(--cc-surface)",
          borderRadius: "16px",
          border: "1px solid var(--cc-border)",
        }}
      >
        <div className="flex items-start justify-between gap-4" style={{ marginBottom: "16px" }}>
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--cc-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {isToday ? "Today" : selectedDate}
            </p>
            <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--cc-text-primary)", marginTop: "2px" }}>
              {totals.calories} <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--cc-text-tertiary)" }}>kcal logged</span>
            </h2>
          </div>
          <button
            onClick={() => setGoalsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 transition-colors"
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--cc-text-secondary)",
              background: "var(--cc-surface-2)",
              border: "1px solid var(--cc-border)",
              borderRadius: "980px",
            }}
            aria-label="Edit goals"
          >
            <Settings className="w-3.5 h-3.5" />
            Goals
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-6">
          <CalorieRing consumed={totals.calories} goal={effectiveGoals.dailyCalories} />
          <div className="flex-1 w-full flex flex-col justify-center">
            <MacroBars
              protein={{ current: totals.protein, goal: effectiveGoals.protein }}
              carbs={{ current: totals.carbs, goal: effectiveGoals.carbs }}
              fat={{ current: totals.fat, goal: effectiveGoals.fat }}
            />
          </div>
        </div>
      </div>

      {/* Weekly chart */}
      <div
        className="p-5 sm:p-6"
        style={{
          background: "var(--cc-surface)",
          borderRadius: "16px",
          border: "1px solid var(--cc-border)",
        }}
      >
        <WeeklyChart
          dates={weekDates}
          byDay={byDay}
          goal={effectiveGoals.dailyCalories}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </div>

      {/* Logged meals + add */}
      <div
        className="p-5 sm:p-6"
        style={{
          background: "var(--cc-surface)",
          borderRadius: "16px",
          border: "1px solid var(--cc-border)",
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: "12px" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--cc-text-primary)" }}>
            {isToday ? "Today's meals" : "Meals"}
          </h3>
          <button
            onClick={() => setSheetOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-white transition-colors"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              background: "var(--cc-accent)",
              borderRadius: "980px",
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Log meal
          </button>
        </div>
        <MealLogList logs={todaysLogs} onDelete={handleDelete} />
      </div>

      <GoalsDialog
        open={goalsOpen}
        initial={goals}
        onClose={() => setGoalsOpen(false)}
        onSave={handleSaveGoals}
      />

      <LogMealSheet
        open={sheetOpen}
        date={selectedDate}
        weekPlan={weekPlan}
        isSignedIn={isSignedIn}
        prefill={pendingPrefill}
        onClose={() => {
          setSheetOpen(false);
          setPendingPrefill(null);
        }}
        onSave={handleSaveLog}
      />
    </div>
  );
}
