"use client";

import React from "react";
import { pctOf } from "@/lib/nutrition";

interface Props {
  protein: { current: number; goal: number };
  carbs: { current: number; goal: number };
  fat: { current: number; goal: number };
}

/**
 * Macro bars — artboard w4b.
 *
 * Tones are the artboard's, and match the mobile plan tab's `Macro` helper so
 * the same nutrient is the same colour on both surfaces: protein lime, carbs
 * orange, fat plum. Bars use meshi-b's `.progress` component rather than a
 * hand-rolled track — `.progress-lime` is the only tone with a class, so the
 * other two set `background` on the inner `<i>`.
 */
const MACROS = [
  { key: "protein" as const, label: "Protein", fill: null },
  { key: "carbs" as const, label: "Carbs", fill: "var(--m-orange)" },
  { key: "fat" as const, label: "Fat", fill: "var(--m-plum-2)" },
];

export function MacroBars({ protein, carbs, fat }: Props) {
  const data = { protein, carbs, fat };
  return (
    <div className="vstack" style={{ gap: 11, width: "100%" }}>
      {MACROS.map(({ key, label, fill }) => {
        const { current, goal } = data[key];
        const pct = pctOf(current, goal);
        const over = current > goal && goal > 0;
        return (
          <div key={key}>
            <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 5 }}>
              <span className="t-cap" style={{ color: "var(--m-ink)" }}>{label}</span>
              <span className="t-cap" style={{ color: over ? "var(--m-red)" : undefined }}>
                {Math.round(current)} / {goal}g
              </span>
            </div>
            <div className={`progress ${fill === null ? "progress-lime" : ""}`}>
              <i
                style={{
                  width: `${pct}%`,
                  background: over ? "var(--m-red)" : fill ?? undefined,
                  transition: "width 0.4s ease-out, background 0.2s",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
