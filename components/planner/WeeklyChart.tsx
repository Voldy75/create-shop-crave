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

export function WeeklyChart({ dates, byDay, goal, selectedDate, onSelectDate }: Props) {
  const safeGoal = Math.max(1, goal);
  const max = Math.max(safeGoal * 1.2, ...dates.map((d) => byDay[d]?.calories || 0));
  const goalPct = (safeGoal / max) * 100;

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between" style={{ marginBottom: "10px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--cc-text-primary)" }}>This week</h3>
        <span style={{ fontSize: "11px", color: "var(--cc-text-tertiary)" }}>
          Goal: {goal} kcal/day
        </span>
      </div>
      <div
        className="relative grid grid-cols-7 gap-2"
        style={{ height: "120px", padding: "0 4px" }}
      >
        {/* Goal line */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: `calc(${goalPct}% + 18px)`,
            height: "1px",
            borderTop: "1px dashed var(--cc-border-strong)",
            pointerEvents: "none",
          }}
        />
        {dates.map((d) => {
          const cal = byDay[d]?.calories || 0;
          const pct = (cal / max) * 100;
          const isSelected = d === selectedDate;
          const over = cal > goal;
          return (
            <button
              key={d}
              onClick={() => onSelectDate?.(d)}
              className="flex flex-col items-center justify-end h-full transition-opacity hover:opacity-90 relative"
              style={{
                // Subtle pill behind the selected column to anchor focus
                background: isSelected ? "rgba(255,107,53,0.08)" : "transparent",
                borderRadius: "10px",
                padding: "2px",
              }}
            >
              <div
                className="flex flex-col justify-end w-full"
                style={{ height: "100%", paddingBottom: "4px" }}
              >
                <div
                  style={{
                    height: `${Math.max(pct, cal > 0 ? 4 : 0)}%`,
                    background: over ? "#ff453a" : isSelected ? "var(--cc-accent)" : "var(--cc-surface-2)",
                    borderRadius: "6px 6px 2px 2px",
                    transition: "height 0.4s ease-out, background 0.2s",
                    minHeight: cal > 0 ? "4px" : "0",
                  }}
                  title={`${cal} kcal`}
                />
              </div>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: isSelected ? "var(--cc-accent)" : "var(--cc-text-tertiary)",
                  marginTop: "4px",
                  letterSpacing: "0.02em",
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
