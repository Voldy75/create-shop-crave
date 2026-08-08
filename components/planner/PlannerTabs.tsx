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
 * Planner tab switcher. The w4b artboard draws only the tracker, so it has no
 * opinion on this control — it is meshi's `.seg` segmented pill, matching the
 * week/month toggle inside the tracker rather than inventing a second
 * switcher shape on the same screen.
 */
export function PlannerTabs({ active, onChange, coachEnabled = false }: Props) {
  return (
    <div className="seg" role="tablist" aria-label="Planner view">
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
            className={isActive ? "seg-on" : ""}
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
