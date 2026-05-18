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
  updateMealLog,
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
import { deleteMealLogRemote, pushMealLog, pushNutritionGoals } from "@/lib/meal-sync";
import { TRACKER_SYNC_EVENT } from "@/app/context/UserContext";
import { CalorieRing } from "./CalorieRing";
import { MacroBars } from "./MacroBars";
import { WeeklyChart } from "./WeeklyChart";
import { HistoryCalendar } from "./HistoryCalendar";
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
  const [editingLog, setEditingLog] = useState<MealLog | null>(null);

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

  // Re-read from localStorage after a sync (sign-in pulled server state).
  useEffect(() => {
    const onSynced = () => {
      setLogs(getMealLogs());
      const stored = getNutritionGoals();
      if (stored) setGoals(stored);
    };
    if (typeof window === "undefined") return;
    window.addEventListener(TRACKER_SYNC_EVENT, onSynced);
    return () => window.removeEventListener(TRACKER_SYNC_EVENT, onSynced);
  }, []);

  const effectiveGoals = goals ?? DEFAULT_GOALS;

  const [historyMode, setHistoryMode] = useState<"week" | "month">("week");

  const todaysLogs = useMemo(
    () => logs.filter((l) => l.date === selectedDate),
    [logs, selectedDate],
  );
  const totals = useMemo(() => dayTotals(logs, selectedDate), [logs, selectedDate]);
  const byDay = useMemo(() => logsByDay(logs, weekDates), [logs, weekDates]);
  // Month view uses the full log set (logsByDay handles arbitrary date arrays).
  // We pass every logged date as the keys array, then HistoryCalendar reads
  // byDay[cell.date] for whichever month the user is browsing.
  const byDate = useMemo(() => {
    const allDates = Array.from(new Set(logs.map((l) => l.date)));
    return logsByDay(logs, allDates);
  }, [logs]);

  const handleSaveLog = (input: Omit<MealLog, "id" | "loggedAt">) => {
    const saved = saveMealLog(input);
    setLogs((prev) => [saved, ...prev]);
    if (isSignedIn) pushMealLog(saved).catch(() => {});
  };

  const handleDelete = (id: string) => {
    deleteMealLog(id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
    if (isSignedIn) deleteMealLogRemote(id).catch(() => {});
  };

  const handleEditLog = (id: string, patch: Partial<MealLog>) => {
    updateMealLog(id, patch);
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setEditingLog(null);
    if (isSignedIn) {
      const updated = { ...(logs.find((l) => l.id === id) as MealLog), ...patch };
      pushMealLog(updated).catch(() => {});
    }
  };

  const handleSaveGoals = (next: NutritionGoals) => {
    saveNutritionGoals(next);
    setGoals(next);
    if (isSignedIn) pushNutritionGoals(next).catch(() => {});
  };

  if (!hydrated) {
    // Three card-shaped skeletons matching the final layout. Pulses gently to
    // signal loading without showing a bare spinner.
    return (
      <div className="flex flex-col gap-6">
        <SkeletonCard heightPx={210} />
        <SkeletonCard heightPx={200} />
        <SkeletonCard heightPx={260} />
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
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 transition-colors flex-shrink-0"
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--cc-text-secondary)",
              background: "var(--cc-surface-2)",
              border: "1px solid var(--cc-border)",
              borderRadius: "980px",
              minHeight: "32px",
            }}
            aria-label="Edit goals"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Goals</span>
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

      {/* History (week or month) */}
      <div
        className="p-5 sm:p-6"
        style={{
          background: "var(--cc-surface)",
          borderRadius: "16px",
          border: "1px solid var(--cc-border)",
        }}
      >
        <div className="flex justify-end" style={{ marginBottom: "12px" }}>
          <div
            role="tablist"
            className="inline-flex p-0.5 gap-0.5"
            style={{
              background: "var(--cc-surface-2)",
              border: "1px solid var(--cc-border)",
              borderRadius: "999px",
            }}
          >
            {(["week", "month"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={historyMode === m}
                onClick={() => setHistoryMode(m)}
                className="px-3 py-1 capitalize transition-colors"
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  background: historyMode === m ? "var(--cc-accent)" : "transparent",
                  color: historyMode === m ? "#fff" : "var(--cc-text-secondary)",
                  borderRadius: "999px",
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        {historyMode === "week" ? (
          <WeeklyChart
            dates={weekDates}
            byDay={byDay}
            goal={effectiveGoals.dailyCalories}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        ) : (
          <HistoryCalendar
            byDay={byDate}
            goal={effectiveGoals.dailyCalories}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        )}
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
        <MealLogList
          logs={todaysLogs}
          onDelete={handleDelete}
          onEdit={(log) => {
            setEditingLog(log);
            setPendingPrefill(null);
            setSheetOpen(true);
          }}
        />
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
        editLog={editingLog}
        onClose={() => {
          setSheetOpen(false);
          setPendingPrefill(null);
          setEditingLog(null);
        }}
        onSave={handleSaveLog}
        onEdit={handleEditLog}
      />
    </div>
  );
}

function SkeletonCard({ heightPx }: { heightPx: number }) {
  return (
    <div
      className="animate-pulse"
      style={{
        height: `${heightPx}px`,
        background: "var(--cc-surface)",
        border: "1px solid var(--cc-border)",
        borderRadius: "16px",
      }}
    />
  );
}
