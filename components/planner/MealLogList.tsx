"use client";

import React from "react";
import { Trash2, Pencil, Plus } from "lucide-react";
import { mascotComponentFor } from "@/lib/ingredient-mascot";
import type { MealLog, MealSource, MealType } from "@/lib/types";

interface Props {
  logs: MealLog[];
  onDelete: (id: string) => void;
  onEdit?: (log: MealLog) => void;
  /** Opens the log sheet prefilled to a meal type — drives the artboard's "Log now" rows. */
  onLog?: (mealType: MealType) => void;
}

const TYPE_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const TYPE_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

/**
 * Meals the day is expected to contain, so a missing one is worth prompting.
 * Snack is deliberately NOT here — "you haven't snacked yet" is not a gap, and
 * a prompt for it would nag rather than help.
 */
const PROMPTED: MealType[] = ["breakfast", "lunch", "dinner"];

/** Tile tint per meal type — the artboard's peach / green / lavender rhythm. */
const TYPE_TINT: Record<MealType, string> = {
  breakfast: "var(--m-tint-peach)",
  lunch: "var(--m-tint-green)",
  dinner: "var(--m-tint-lav)",
  snack: "var(--m-cream-2)",
};

const SOURCE_LABEL: Record<MealSource, string> = {
  planned: "from plan",
  search: "from search",
  manual: "manual",
  photo: "via Bo",
};

/** ISO timestamp → "8:20 AM". Returns null rather than guessing on a bad value. */
function timeOf(log: MealLog): string | null {
  const d = new Date(log.loggedAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Today's meals — artboard w4b.
 *
 * Flat and ordered by meal type rather than grouped under per-type headings:
 * the artboard puts the type in the row title ("Breakfast · Avocado toast"),
 * which carries the same information in less vertical space. The per-group
 * kcal subtotal is dropped because the day total is already the ring.
 *
 * Ingredient mascots stand in for a photo when there is none — the same
 * `lib/ingredient-mascot.ts` mapping the recipe view uses, so a dish resolves
 * to the same character everywhere. DESIGN.md's rule against dish photos on
 * ingredient tiles does not apply in reverse: a mascot for a meal is a
 * deliberate flat-illustration stand-in, not a misleading photo.
 */
export function MealLogList({ logs, onDelete, onEdit, onLog }: Props) {
  const ordered = TYPE_ORDER.flatMap((type) => logs.filter((l) => l.mealType === type));
  const missing = onLog
    ? PROMPTED.filter((type) => !logs.some((l) => l.mealType === type))
    : [];

  if (ordered.length === 0 && missing.length === 0) {
    return (
      <div className="vstack" style={{ alignItems: "center", textAlign: "center", padding: "36px 16px", gap: 4 }}>
        <span className="t-h2">Nothing logged yet</span>
        <span className="t-cap">Log a meal and Bo does the math.</span>
      </div>
    );
  }

  return (
    <div className="vstack" style={{ gap: 10 }}>
      {ordered.map((log) => {
        const Mascot = mascotComponentFor(log.name);
        const time = timeOf(log);
        return (
          <div
            key={log.id}
            className="row group"
            style={{ boxShadow: "none", background: "var(--m-cream)", padding: "12px 14px" }}
          >
            {log.imageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={log.imageDataUrl}
                alt=""
                style={{ width: 44, height: 44, borderRadius: 12, objectFit: "cover", flex: "none" }}
              />
            ) : (
              <span
                className="hstack"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: TYPE_TINT[log.mealType],
                  justifyContent: "center",
                  flex: "none",
                }}
              >
                <Mascot width={30} height={30} />
              </span>
            )}

            <div className="vstack grow" style={{ gap: 0, minWidth: 0 }}>
              <span
                className="t-h2"
                style={{ fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {TYPE_LABEL[log.mealType]} · {log.name}
              </span>
              <span className="t-cap">
                {[time, SOURCE_LABEL[log.source], `${Math.round(log.protein)}P · ${Math.round(log.carbs)}C · ${Math.round(log.fat)}F`]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>

            <span className="t-h2" style={{ flex: "none" }}>{Math.round(log.calories)} kcal</span>

            {/* Always visible below sm (no hover there); reveal on hover above it. */}
            <div
              className="hstack opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity"
              style={{ gap: 2, flex: "none" }}
            >
              {onEdit && (
                <button
                  onClick={() => onEdit(log)}
                  className="icon-btn"
                  style={{ width: 30, height: 30, borderRadius: 9, boxShadow: "none", background: "transparent" }}
                  aria-label={`Edit ${log.name}`}
                >
                  <Pencil width={14} height={14} />
                </button>
              )}
              <button
                onClick={() => onDelete(log.id)}
                className="icon-btn"
                style={{ width: 30, height: 30, borderRadius: 9, boxShadow: "none", background: "transparent", color: "var(--m-red)" }}
                aria-label={`Delete ${log.name}`}
              >
                <Trash2 width={14} height={14} />
              </button>
            </div>
          </div>
        );
      })}

      {missing.map((type) => (
        <div
          key={`empty-${type}`}
          className="row"
          style={{ boxShadow: "none", background: "var(--m-cream)", padding: "12px 14px" }}
        >
          <span
            className="hstack"
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: TYPE_TINT[type],
              justifyContent: "center",
              flex: "none",
              opacity: 0.55,
            }}
          >
            <Plus width={20} height={20} style={{ color: "var(--m-ink-soft)" }} />
          </span>
          <div className="vstack grow" style={{ gap: 0, minWidth: 0 }}>
            <span className="t-h2" style={{ fontSize: 14 }}>{TYPE_LABEL[type]}</span>
            <span className="t-cap">Not logged yet</span>
          </div>
          <button className="pill-lime pill-sm" onClick={() => onLog?.(type)} style={{ flex: "none" }}>
            Log now
          </button>
        </div>
      ))}
    </div>
  );
}
