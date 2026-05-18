"use client";

import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTH_NAMES, monthGrid, type Totals } from "@/lib/nutrition";

interface Props {
  byDay: Record<string, Totals>;
  goal: number;
  selectedDate: string;
  onSelectDate?: (date: string) => void;
}

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Background intensity scale by % of daily calorie goal:
 *  - 0%        → blank surface
 *  - 1–60%     → faint accent
 *  - 60–90%    → medium accent
 *  - 90–110%   → full accent
 *  - >110%     → red
 */
function intensityBg(cal: number, goal: number): string {
  if (cal <= 0) return "var(--cc-surface-2)";
  const pct = cal / Math.max(goal, 1);
  if (pct > 1.1) return "rgba(255, 69, 58, 0.7)";
  if (pct >= 0.9) return "var(--cc-accent)";
  if (pct >= 0.6) return "rgba(255, 107, 53, 0.45)";
  return "rgba(255, 107, 53, 0.18)";
}

function fgFor(bg: string): string {
  // White text on full-color backgrounds; dim on the faintest fill
  if (bg === "rgba(255, 107, 53, 0.18)") return "var(--cc-text-secondary)";
  if (bg === "var(--cc-surface-2)") return "var(--cc-text-tertiary)";
  return "#ffffff";
}

export function HistoryCalendar({ byDay, goal, selectedDate, onSelectDate }: Props) {
  const today = new Date();
  // Initialize cursor to month of selectedDate so navigating from a logged day stays in context
  const initial = useMemo(() => {
    const [y, m] = selectedDate.split("-").map(Number);
    return { year: y, month: (m || 1) - 1 };
  }, [selectedDate]);
  const [cursor, setCursor] = useState(initial);

  const cells = useMemo(
    () => monthGrid(cursor.year, cursor.month, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cursor.year, cursor.month],
  );

  const monthTotal = useMemo(() => {
    return cells
      .filter((c) => c.inMonth)
      .reduce((sum, c) => sum + (byDay[c.date]?.calories || 0), 0);
  }, [cells, byDay]);

  const loggedDaysInMonth = useMemo(
    () => cells.filter((c) => c.inMonth && (byDay[c.date]?.calories || 0) > 0).length,
    [cells, byDay],
  );

  const goPrev = () =>
    setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }));
  const goNext = () =>
    setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }));

  const monthLabel = `${MONTH_NAMES[cursor.month]} ${cursor.year}`;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between" style={{ marginBottom: "12px" }}>
        <div className="flex items-center gap-1">
          <button
            onClick={goPrev}
            className="p-1.5 transition-colors"
            style={{ borderRadius: "999px", color: "var(--cc-text-secondary)" }}
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--cc-text-primary)", minWidth: "140px", textAlign: "center" }}>
            {monthLabel}
          </h3>
          <button
            onClick={goNext}
            className="p-1.5 transition-colors"
            style={{ borderRadius: "999px", color: "var(--cc-text-secondary)" }}
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <span style={{ fontSize: "11px", color: "var(--cc-text-tertiary)" }}>
          {loggedDaysInMonth > 0 ? `${loggedDaysInMonth} logged · ${monthTotal.toLocaleString()} kcal` : "No logs this month"}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1" style={{ marginBottom: "4px" }}>
        {DOW.map((d, i) => (
          <div
            key={i}
            className="text-center"
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "var(--cc-text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              padding: "4px 0",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const totals = byDay[cell.date];
          const cal = totals?.calories || 0;
          const bg = intensityBg(cal, goal);
          const fg = fgFor(bg);
          const isSelected = cell.date === selectedDate;
          const day = parseInt(cell.date.split("-")[2], 10);
          const isFuture = cell.date > new Date().toISOString().split("T")[0];
          return (
            <button
              key={cell.date}
              onClick={() => onSelectDate?.(cell.date)}
              disabled={isFuture}
              className="aspect-square flex flex-col items-center justify-center transition-all"
              style={{
                background: cell.inMonth ? bg : "transparent",
                opacity: cell.inMonth ? (isFuture ? 0.3 : 1) : 0.35,
                color: fg,
                border: isSelected ? "2px solid var(--cc-text-primary)" : cell.isToday ? "1px solid var(--cc-text-secondary)" : "1px solid transparent",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: cal > 0 ? 700 : 500,
                cursor: isFuture ? "not-allowed" : "pointer",
                minHeight: "36px",
              }}
              aria-label={cell.date + (cal > 0 ? ` · ${cal} kcal` : "")}
            >
              <span>{day}</span>
              {cal > 0 && (
                <span style={{ fontSize: "8px", fontWeight: 500, opacity: 0.85 }}>
                  {cal >= 1000 ? `${(cal / 1000).toFixed(1)}k` : cal}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-3" style={{ fontSize: "10px", color: "var(--cc-text-tertiary)" }}>
        <span>Intensity:</span>
        <Legend bg="rgba(255, 107, 53, 0.18)" label="< 60%" />
        <Legend bg="rgba(255, 107, 53, 0.45)" label="60–90%" />
        <Legend bg="var(--cc-accent)" label="At goal" />
        <Legend bg="rgba(255, 69, 58, 0.7)" label="Over" />
      </div>
    </div>
  );
}

function Legend({ bg, label }: { bg: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: bg }} />
      {label}
    </span>
  );
}
