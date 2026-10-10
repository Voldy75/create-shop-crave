"use client";

import React from "react";
import { Calendar, Activity, Sparkles } from "lucide-react";

export type PlannerTab = "plan" | "tracker" | "coach";

interface Props {
  active: PlannerTab;
  onChange: (tab: PlannerTab) => void;
  coachEnabled?: boolean;
}

const TABS: { id: PlannerTab; label: string; icon: React.ComponentType<{ width?: number; height?: number }> }[] = [
  { id: "plan", label: "Plan", icon: Calendar },
  { id: "tracker", label: "Tracker", icon: Activity },
  { id: "coach", label: "Coach", icon: Sparkles },
];

/**
 * Planner tab switcher, now on w8c/w8d's `.pseg`.
 *
 * w8c and w8d both draw this control explicitly — a taller pill-segmented
 * Plan / Tracker / Coach group — where the older w4b artboard drew only the
 * tracker and had no opinion. `.seg` is kept for the week/month toggle INSIDE
 * the tracker, so the two levels of switcher are now visually distinct instead
 * of being the same control at the same size.
 */
export function PlannerTabs({ active, onChange, coachEnabled = false }: Props) {
  return (
    <div className="pseg" role="tablist" aria-label="Planner view">
      {TABS.map(({ id, label, icon: Icon }) => {
        const disabled = id === "coach" && !coachEnabled;
        const isActive = active === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`planner-panel-${id}`}
            disabled={disabled}
            onClick={() => !disabled && onChange(id)}
            className={isActive ? "is-active" : ""}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              opacity: disabled ? 0.45 : 1,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            <Icon width={15} height={15} />
            {label}
            {disabled && (
              <span className="t-micro" style={{ color: "var(--m-ink-soft)" }}>soon</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
