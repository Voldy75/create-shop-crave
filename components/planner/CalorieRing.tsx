"use client";

import React from "react";

interface Props {
  consumed: number;
  goal: number;
  size?: number;
  stroke?: number;
}

export function CalorieRing({ consumed, goal, size = 168, stroke = 14 }: Props) {
  const safeGoal = Math.max(1, goal);
  const pct = Math.min(1, consumed / safeGoal);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const remaining = Math.max(0, goal - consumed);
  const over = consumed > goal;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--cc-surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={over ? "#ff453a" : "var(--cc-accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s ease-out, stroke 0.2s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--cc-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {over ? "Over" : "Remaining"}
        </span>
        <span style={{ fontSize: "32px", fontWeight: 700, color: "var(--cc-text-primary)", lineHeight: 1.1, marginTop: "2px" }}>
          {over ? consumed - goal : remaining}
        </span>
        <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--cc-text-secondary)" }}>
          of {goal} kcal
        </span>
      </div>
    </div>
  );
}
