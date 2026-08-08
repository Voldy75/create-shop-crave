"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Camera, Settings } from "lucide-react";
import {
  deleteMealLog,
  getMealLogs,
  getNutritionGoals,
  saveMealLog,
  saveNutritionGoals,
  takePendingMealLog,
  updateMealLog,
  type WeekPlan,
} from "@/lib/storage";
import {
  dayTotals,
  lastNDates,
  localDateKey,
  logsByDay,
} from "@/lib/nutrition";
import type { MealLog, MealType, NutritionGoals } from "@/lib/types";
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

/**
 * Everything LogMealSheet's own `Prefill` accepts. Declared here because that
 * type is not exported and a "Log now" row only ever supplies a meal type —
 * `PendingMealLog` cannot express that, since it requires a name and macros.
 */
type SheetPrefill = {
  name?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  source?: MealLog["source"];
  mealType?: MealType;
  notes?: string;
};

interface Props {
  weekPlan: WeekPlan;
  isSignedIn: boolean;
  autoOpenLog?: boolean;
}

/**
 * Tracker — artboard w4b.
 *
 * Layout is the artboard's: a two-up row of [calorie ring + macros] and [week
 * chart], then a full-width meals card below. On the artboard that row is a
 * fixed `wgrid2`; here it collapses to one column under 900px, because the
 * ring and the seven-bar chart both stop being readable side by side well
 * before the sidebar breakpoint.
 *
 * Two controls the artboard does not draw are kept, because removing them
 * would remove the only way to reach a real feature:
 *   - **Goals** (the gear by the headline) — nothing else sets the targets
 *     every number on this screen is measured against.
 *   - **week / month** — the month calendar is the only route to a past day
 *     outside the last seven.
 */
export function TrackerView({ weekPlan, isSignedIn, autoOpenLog = false }: Props) {
  const today = useMemo(() => localDateKey(), []);
  const weekDates = useMemo(() => lastNDates(7), []);
  const [hydrated, setHydrated] = useState(false);
  const [goals, setGoals] = useState<NutritionGoals | null>(null);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingPrefill, setPendingPrefill] = useState<SheetPrefill | null>(null);
  const [editingLog, setEditingLog] = useState<MealLog | null>(null);
  const [historyMode, setHistoryMode] = useState<"week" | "month">("week");

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

  /**
   * The week average, and the day count it covers. Stating the count matters:
   * "avg 1,820 kcal" across a 7-day chart with 3 days logged is a quietly
   * misleading number — the same decision the mobile week screen took.
   */
  const weekAvg = useMemo(() => {
    const logged = weekDates.filter((d) => (byDay[d]?.calories || 0) > 0);
    if (logged.length === 0) return null;
    const sum = logged.reduce((s, d) => s + (byDay[d]?.calories || 0), 0);
    return { avg: Math.round(sum / logged.length), days: logged.length };
  }, [weekDates, byDay]);

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

  const openSheet = (prefill: SheetPrefill | null) => {
    setEditingLog(null);
    setPendingPrefill(prefill);
    setSheetOpen(true);
  };

  if (!hydrated) {
    return (
      <div className="vstack" style={{ gap: 18 }}>
        <div className="tracker-grid">
          <SkeletonCard heightPx={194} />
          <SkeletonCard heightPx={194} />
        </div>
        <SkeletonCard heightPx={260} />
      </div>
    );
  }

  const isToday = selectedDate === today;
  const left = effectiveGoals.dailyCalories - totals.calories;
  const over = left < 0;

  return (
    <div className="vstack" style={{ gap: 18 }}>
      <div className="tracker-grid">
        {/* ── Ring + macros ── */}
        <div className="card" style={{ padding: 22, display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
          <CalorieRing consumed={totals.calories} goal={effectiveGoals.dailyCalories} />
          <div className="vstack grow" style={{ gap: 14, minWidth: 190 }}>
            <div className="hstack" style={{ justifyContent: "space-between", gap: 8 }}>
              <span className="t-h1">
                {over ? "Over by: " : "Calories left: "}
                <span style={{ color: over ? "var(--m-red)" : "var(--m-forest)" }}>
                  {Math.abs(left).toLocaleString()}
                </span>
              </span>
              <button
                onClick={() => setGoalsOpen(true)}
                className="icon-btn"
                style={{ width: 34, height: 34, borderRadius: 11, flex: "none" }}
                aria-label="Edit goals"
                title="Edit goals"
              >
                <Settings width={16} height={16} />
              </button>
            </div>
            <MacroBars
              protein={{ current: totals.protein, goal: effectiveGoals.protein }}
              carbs={{ current: totals.carbs, goal: effectiveGoals.carbs }}
              fat={{ current: totals.fat, goal: effectiveGoals.fat }}
            />
          </div>
        </div>

        {/* ── Week chart / month calendar ── */}
        <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column" }}>
          <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
            <span className="t-h1">{historyMode === "week" ? "This week" : "History"}</span>
            <div className="hstack" style={{ gap: 10 }}>
              {historyMode === "week" && (
                <span className="t-cap" style={{ color: "var(--m-forest)" }}>
                  {weekAvg
                    ? `avg ${weekAvg.avg.toLocaleString()} · ${weekAvg.days} day${weekAvg.days === 1 ? "" : "s"}`
                    : "nothing logged yet"}
                </span>
              )}
              <div className="seg" role="group" aria-label="History range">
                {(["week", "month"] as const).map((m) => (
                  <button
                    key={m}
                    className={historyMode === m ? "seg-on" : ""}
                    aria-pressed={historyMode === m}
                    onClick={() => setHistoryMode(m)}
                    style={{ height: 28, padding: "0 12px", textTransform: "capitalize" }}
                  >
                    {m}
                  </button>
                ))}
              </div>
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
      </div>

      {/* ── Meals ── */}
      <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column" }}>
        <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
          <span className="t-h1">{isToday ? "Today's meals" : `Meals · ${selectedDate}`}</span>
          <button className="pill-primary pill-sm" style={{ gap: 8 }} onClick={() => openSheet(null)}>
            <Camera width={16} height={16} />
            Log a meal
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
          onLog={(mealType) => openSheet({ mealType })}
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
      className="card animate-pulse"
      style={{ height: `${heightPx}px`, background: "var(--m-cream-2)", boxShadow: "none" }}
    />
  );
}
