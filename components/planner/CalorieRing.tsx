"use client";

import React from "react";

interface Props {
  consumed: number;
  goal: number;
  size?: number;
  stroke?: number;
}

/**
 * Calorie ring — artboard w4b.
 *
 * The artboard draws this as a conic-gradient disc with a card-coloured well
 * punched out of the middle. This stays an SVG ring instead: same silhouette
 * (the default 150/19 matches the artboard's 150px outer and 112px inner), but
 * the arc can animate on change and a conic-gradient cannot.
 *
 * The centre reads CONSUMED ("1,380 of 2,000"), not remaining — remaining is
 * the headline next to the ring in w4b. Two numbers, each in one place.
 */
export function CalorieRing({ consumed, goal, size = 150, stroke = 19 }: Props) {
  const safeGoal = Math.max(1, goal);
  const pct = Math.min(1, consumed / safeGoal);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const over = consumed > goal;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size, flex: "none" }}
      role="img"
      aria-label={`${Math.round(consumed)} of ${goal} kcal logged`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--m-cream-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={over ? "var(--m-red)" : "var(--m-forest)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s ease-out, stroke 0.2s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ gap: 1 }}>
        <span
          className="t-d1"
          style={{ color: over ? "var(--m-red)" : "var(--m-forest)", lineHeight: 1 }}
        >
          {Math.round(consumed).toLocaleString()}
        </span>
        <span className="t-cap">of {goal.toLocaleString()}</span>
      </div>
    </div>
  );
}
