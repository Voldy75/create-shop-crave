"use client";

/**
 * The task status strip pinned to the top of a Bo chat: what kind of task it
 * is, where it stands (Finding → Cart → Your OK → Payment → Placed), and one
 * line of what is happening or what the user needs to do. Derived from the
 * messages by lib/bo/task-status.ts. Shared by both root layouts: meshi-b
 * classes and tokens only.
 */

import { ChefHat, ShoppingBag, ShoppingBasket, Utensils, type LucideIcon } from "lucide-react";
import type { BoTaskKind, BoTaskStatus } from "@/lib/bo/task-status";

const KIND: Record<BoTaskKind, [LucideIcon, string]> = {
  order: [ShoppingBag, "Ordering in"],
  grocery: [ShoppingBasket, "Groceries"],
  dine_in: [Utensils, "Table"],
  cook: [ChefHat, "Cooking"],
};

export function TaskStatusCard({ status }: { status: BoTaskStatus }) {
  const [Icon, kindName] = KIND[status.kind];
  const warn = status.tone === "warn";
  const finished = status.tone === "done";

  return (
    <div className="card vstack" role="status" aria-live="polite" style={{ padding: "10px 14px", gap: 8 }}>
      <div className="hstack" style={{ gap: 10, alignItems: "flex-start" }}>
        <Icon width={18} height={18} aria-hidden style={{ flex: "none", marginTop: 2, color: warn ? "var(--text-burnt)" : "var(--figure-accent)" }} />
        <div className="vstack grow" style={{ gap: 2, minWidth: 0 }}>
          <span className="t-body" style={{ fontSize: 14, fontWeight: 800 }}>
            <span className="sr-only">{kindName}: </span>
            {status.label}
            {status.tone === "working" ? "…" : ""}
          </span>
          {status.detail && <span className="t-cap">{status.detail}</span>}
        </div>
        {status.tone === "you" ? (
          <span className="badge badge-forest" style={{ flex: "none" }}>Your turn</span>
        ) : (
          <span className="t-micro" aria-hidden style={{ flex: "none", marginTop: 3 }}>{kindName}</span>
        )}
      </div>
      <ol aria-label="Progress" className="hstack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 4 }}>
        {status.stages.map((name, i) => {
          const past = i < status.current || (i === status.current && finished);
          const now = i === status.current && !finished;
          const fill = past || now ? (now && warn ? "var(--m-burnt)" : "var(--figure-accent)") : "var(--m-ink-soft)";
          // Done: solid. Now: half (Bo is on it). Still to come: a faint track.
          const opacity = past || (now && warn) ? 1 : now ? 0.55 : 0.22;
          return (
            <li key={name} className="vstack grow" style={{ gap: 4, minWidth: 0 }} aria-current={now ? "step" : undefined}>
              <span aria-hidden style={{ height: 4, borderRadius: 999, background: fill, opacity }} />
              <span
                className="t-cap"
                style={{ fontSize: 11, fontWeight: now ? 800 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {name}
                <span className="sr-only">{past ? " (done)" : now ? " (now)" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
