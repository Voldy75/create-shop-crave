"use client";

import React from "react";
import { Calendar, Activity, Sparkles } from "lucide-react";

export type PlannerTab = "plan" | "tracker" | "coach";

interface Props {
  active: PlannerTab;
  onChange: (tab: PlannerTab) => void;
  coachEnabled?: boolean;
}

const TABS: { id: PlannerTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "plan", label: "Plan", icon: Calendar },
  { id: "tracker", label: "Tracker", icon: Activity },
  { id: "coach", label: "Coach", icon: Sparkles },
];

export function PlannerTabs({ active, onChange, coachEnabled = false }: Props) {
  return (
    <div
      role="tablist"
      className="inline-flex p-1 gap-1"
      style={{
        background: "var(--cc-surface)",
        border: "1px solid var(--cc-border)",
        borderRadius: "980px",
      }}
    >
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
            className="flex items-center gap-1.5 px-4 py-2 transition-colors"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              borderRadius: "980px",
              background: isActive ? "var(--cc-accent)" : "transparent",
              color: isActive ? "#ffffff" : disabled ? "var(--cc-text-tertiary)" : "var(--cc-text-secondary)",
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {disabled && (
              <span
                style={{
                  fontSize: "9px",
                  padding: "1px 6px",
                  borderRadius: "980px",
                  background: "var(--cc-surface-2)",
                  color: "var(--cc-text-tertiary)",
                  marginLeft: "4px",
                }}
              >
                Soon
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
