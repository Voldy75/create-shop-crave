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
 * Intensity scale by % of daily calorie goal.
 *
 * The old scale ramped through tints of the retired Midnight Kitchen orange,
 * so this grid was the last place on the tracker still painting that brand.
 * It now ramps the meshi greens — pale tint → lime → forest — which reads as
 * "closer to goal" the way the old one did, with red still reserved for over.
 *
 * Background and foreground are returned together: the old version re-derived
 * the text colour by string-comparing the background, which silently breaks
 * the moment a value is edited.
 */
function intensity(cal: number, goal: number): { bg: string; fg: string } {
  if (cal <= 0) return { bg: "var(--m-cream-2)", fg: "var(--m-ink-soft)" };
  const pct = cal / Math.max(goal, 1);
  if (pct > 1.1) return { bg: "var(--m-red)", fg: "var(--m-on-deep)" };
  if (pct >= 0.9) return { bg: "var(--m-forest)", fg: "var(--m-on-deep)" };
  if (pct >= 0.6) return { bg: "var(--m-lime)", fg: "var(--m-forest-2)" };
  return { bg: "var(--m-tint-green)", fg: "var(--m-ink)" };
}

const LEGEND: { bg: string; label: string }[] = [
  { bg: "var(--m-tint-green)", label: "< 60%" },
  { bg: "var(--m-lime)", label: "60–90%" },
  { bg: "var(--m-forest)", label: "At goal" },
  { bg: "var(--m-red)", label: "Over" },
];

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
    <div style={{ width: "100%" }}>
      <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
        <div className="hstack" style={{ gap: 2 }}>
          <button
            onClick={goPrev}
            className="icon-btn"
            style={{ width: 30, height: 30, borderRadius: 9, boxShadow: "none", background: "transparent" }}
            aria-label="Previous month"
          >
            <ChevronLeft width={16} height={16} />
          </button>
          <span className="t-h2" style={{ minWidth: 140, textAlign: "center" }}>{monthLabel}</span>
          <button
            onClick={goNext}
            className="icon-btn"
            style={{ width: 30, height: 30, borderRadius: 9, boxShadow: "none", background: "transparent" }}
            aria-label="Next month"
          >
            <ChevronRight width={16} height={16} />
          </button>
        </div>
        <span className="t-cap">
          {loggedDaysInMonth > 0
            ? `${loggedDaysInMonth} logged · ${monthTotal.toLocaleString()} kcal`
            : "No logs this month"}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1" style={{ marginBottom: 4 }}>
        {DOW.map((d, i) => (
          <div key={i} className="t-micro" style={{ textAlign: "center", padding: "4px 0" }}>
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const cal = byDay[cell.date]?.calories || 0;
          const { bg, fg } = intensity(cal, goal);
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
                border: isSelected
                  ? "2px solid var(--m-ink)"
                  : cell.isToday
                    ? "1.5px solid var(--m-ink-soft)"
                    : "1.5px solid transparent",
                borderRadius: 10,
                font: `${cal > 0 ? 800 : 600} 12px var(--m-font-display)`,
                cursor: isFuture ? "not-allowed" : "pointer",
                minHeight: 36,
              }}
              aria-label={cell.date + (cal > 0 ? ` · ${cal} kcal` : "")}
            >
              <span>{day}</span>
              {cal > 0 && (
                <span style={{ fontSize: 8, fontWeight: 600, opacity: 0.85 }}>
                  {cal >= 1000 ? `${(cal / 1000).toFixed(1)}k` : cal}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="hstack" style={{ gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        <span className="t-cap">Intensity:</span>
        {LEGEND.map(({ bg, label }) => (
          <span key={label} className="hstack" style={{ gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: bg }} />
            <span className="t-cap">{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
