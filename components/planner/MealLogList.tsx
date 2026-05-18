"use client";

import React from "react";
import { Trash2, Pencil, Camera, Search, PenLine, CalendarCheck } from "lucide-react";
import type { MealLog, MealSource, MealType } from "@/lib/types";

interface Props {
  logs: MealLog[];
  onDelete: (id: string) => void;
  onEdit?: (log: MealLog) => void;
}

const TYPE_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const TYPE_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const SOURCE_ICON: Record<MealSource, React.ComponentType<{ className?: string }>> = {
  planned: CalendarCheck,
  search: Search,
  manual: PenLine,
  photo: Camera,
};

const SOURCE_LABEL: Record<MealSource, string> = {
  planned: "From plan",
  search: "From search",
  manual: "Manual",
  photo: "Photo",
};

export function MealLogList({ logs, onDelete, onEdit }: Props) {
  if (logs.length === 0) {
    return (
      <div
        className="flex flex-col items-center text-center"
        style={{ padding: "40px 16px", color: "var(--cc-text-tertiary)" }}
      >
        <span style={{ fontSize: "28px", marginBottom: "8px" }}>🍽️</span>
        <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--cc-text-primary)" }}>
          Nothing logged yet
        </p>
        <p style={{ fontSize: "12px", marginTop: "4px" }}>
          Tap &ldquo;Log meal&rdquo; to add what you ate.
        </p>
      </div>
    );
  }

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    items: logs.filter((l) => l.mealType === type),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {grouped.map(({ type, items }) => {
        const groupKcal = items.reduce((s, l) => s + (l.calories || 0), 0);
        return (
          <div key={type}>
            <div className="flex items-baseline justify-between" style={{ marginBottom: "6px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--cc-text-tertiary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {TYPE_LABEL[type]}
              </span>
              <span style={{ fontSize: "11px", color: "var(--cc-text-tertiary)" }}>
                {groupKcal} kcal
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((log) => {
                const SourceIcon = SOURCE_ICON[log.source];
                return (
                  <div
                    key={log.id}
                    className="group flex items-center gap-3 p-3"
                    style={{
                      background: "var(--cc-surface)",
                      border: "1px solid var(--cc-border)",
                      borderRadius: "12px",
                    }}
                  >
                    {log.imageDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={log.imageDataUrl}
                        alt=""
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "10px",
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        className="flex items-center justify-center"
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "10px",
                          background: "var(--cc-surface-2)",
                          flexShrink: 0,
                          color: "var(--cc-text-tertiary)",
                        }}
                      >
                        <SourceIcon className="w-4 h-4" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "var(--cc-text-primary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {log.name}
                      </p>
                      <p
                        style={{
                          fontSize: "11px",
                          color: "var(--cc-text-tertiary)",
                          marginTop: "2px",
                        }}
                      >
                        {SOURCE_LABEL[log.source]} · {Math.round(log.protein)}P · {Math.round(log.carbs)}C · {Math.round(log.fat)}F
                      </p>
                    </div>
                    <div className="flex flex-col items-end" style={{ flexShrink: 0 }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--cc-text-primary)" }}>
                        {Math.round(log.calories)}
                      </span>
                      <span style={{ fontSize: "10px", color: "var(--cc-text-tertiary)" }}>kcal</span>
                    </div>
                    {/* Always visible on mobile (no hover); reveal-on-hover on desktop */}
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(log)}
                          className="p-1.5"
                          style={{ color: "var(--cc-text-tertiary)", borderRadius: "8px" }}
                          aria-label={`Edit ${log.name}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(log.id)}
                        className="p-1.5"
                        style={{ color: "var(--cc-text-tertiary)", borderRadius: "8px" }}
                        aria-label={`Delete ${log.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
