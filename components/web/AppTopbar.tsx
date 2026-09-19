"use client";

/**
 * AppTopbar — the one topbar for the web app shell.
 *
 * Before this, every converted page hand-rolled the same
 * `<div className="topbar" style={{gap:12, flexWrap:"wrap", minHeight:74,
 * height:"auto"}}>` (chat, cart, planner), while /favorites and /settings kept
 * a `.glass-nav` sticky header with a back arrow — a PHONE pattern, sitting
 * inside a layout that already has a persistent sidebar. Two competing header
 * conventions in one app. This is the single one.
 *
 * `onBack` is opt-in and should stay rare: a back arrow beside a sidebar is
 * usually redundant. It earns its place on genuinely nested screens — the
 * cooking view under a recipe, a ride under a restaurant — which is exactly
 * where the artboards draw one.
 */

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface Props {
  title: string;
  caption?: string;
  /** Where the back arrow goes. Omit for top-level screens. */
  onBack?: string | (() => void);
  /** Right-aligned controls — search, segmented controls, actions. */
  children?: ReactNode;
}

export function AppTopbar({ title, caption, onBack, children }: Props) {
  const router = useRouter();

  return (
    <div className="topbar" style={{ gap: 12, flexWrap: "wrap", minHeight: 74, height: "auto" }}>
      {onBack !== undefined && (
        <button
          className="icon-btn"
          onClick={() => (typeof onBack === "function" ? onBack() : router.push(onBack))}
          aria-label="Go back"
          style={{ flex: "none" }}
        >
          <ArrowLeft width={17} height={17} />
        </button>
      )}

      <div className="vstack" style={{ gap: 0, minWidth: 0 }}>
        <span className="t-d2" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {title}
        </span>
        {caption && <span className="t-cap">{caption}</span>}
      </div>

      <div className="grow" />

      {children}
    </div>
  );
}
