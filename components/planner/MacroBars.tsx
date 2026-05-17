"use client";

import React from "react";
import { pctOf } from "@/lib/nutrition";

interface Props {
  protein: { current: number; goal: number };
  carbs: { current: number; goal: number };
  fat: { current: number; goal: number };
}

const MACROS = [
  { key: "protein" as const, label: "Protein", color: "#34c759" },
  { key: "carbs" as const, label: "Carbs", color: "#0a84ff" },
  { key: "fat" as const, label: "Fat", color: "#ff9f0a" },
];

export function MacroBars({ protein, carbs, fat }: Props) {
  const data = { protein, carbs, fat };
  return (
    <div className="flex flex-col gap-3 w-full">
      {MACROS.map(({ key, label, color }) => {
        const { current, goal } = data[key];
        const pct = pctOf(current, goal);
        return (
          <div key={key}>
            <div className="flex items-baseline justify-between" style={{ marginBottom: "4px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--cc-text-secondary)" }}>
                {label}
              </span>
              <span style={{ fontSize: "11px", color: "var(--cc-text-tertiary)" }}>
                <span style={{ color: "var(--cc-text-primary)", fontWeight: 600 }}>{Math.round(current)}</span>
                {" / "}{goal}g
              </span>
            </div>
            <div
              style={{
                height: "6px",
                borderRadius: "999px",
                background: "var(--cc-surface-2)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: color,
                  borderRadius: "999px",
                  transition: "width 0.4s ease-out",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
