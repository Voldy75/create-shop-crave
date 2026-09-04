"use client";

import React from "react";
import type { Totals } from "@/lib/nutrition";

interface Props {
  dates: string[];           // ordered YYYY-MM-DD
  byDay: Record<string, Totals>;
  goal: number;
  selectedDate: string;
  onSelectDate?: (date: string) => void;
}

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function dowLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return DOW[date.getDay()];
}

/**
 * Week chart — artboard w4b. Bars only; the card's title and average are the
 * caller's, so the week/month toggle can share that one header row.
 *
 * **Bars scale to the GOAL, not to the tallest bar** — carried over from the
 * mobile week screen so the same data does not tell two different stories on
 * the two surfaces. Height therefore means "how close to target"; scaling to
 * the max would make every week look the same shape regardless of the goal.
 */
export function WeeklyChart({ dates, byDay, goal, selectedDate, onSelectDate }: Props) {
  const safeGoal = Math.max(1, goal);
  // Headroom so an over-goal day still has bar left to draw above the line.
  const scaleMax = safeGoal * 1.25;

  return (
    <div className="vstack" style={{ gap: 0, height: "100%" }}>
      <div className="hstack" style={{ alignItems: "flex-end", gap: 12, height: 150 }}>
        {dates.map((d) => {
          const cal = byDay[d]?.calories || 0;
          const pct = Math.min(100, (cal / scaleMax) * 100);
          const isSelected = d === selectedDate;
          const over = cal > goal;
          return (
            <button
              key={d}
              onClick={() => onSelectDate?.(d)}
              aria-pressed={isSelected}
              title={`${cal.toLocaleString()} kcal`}
              className="vstack"
              style={{
                flex: 1,
                gap: 9,
                alignItems: "center",
                justifyContent: "flex-end",
                height: "100%",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              <div className="bar" style={{ height: "100%", width: 30 }}>
                <i
                  style={{
                    height: `${cal > 0 ? Math.max(pct, 4) : 0}%`,
                    background: over
                      ? "var(--m-red)"
                      : isSelected
                        ? "var(--m-lime)"
                        : undefined,
                    transition: "height 0.4s ease-out, background 0.2s",
                  }}
                />
              </div>
              <span
                className="t-cap"
                style={{
                  color: isSelected ? "var(--m-forest)" : undefined,
                  fontWeight: isSelected ? 800 : undefined,
                }}
              >
                {dowLabel(d)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
