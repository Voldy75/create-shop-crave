"use client";

import { Zap, Key } from "lucide-react";

interface UsageBadgeProps {
  count: number;
  limit: number;
  onClick?: () => void;
}

export function UsageBadge({ count, limit, onClick }: UsageBadgeProps) {
  const remaining = Math.max(0, limit - count);
  const isExhausted = remaining === 0;
  const isLow = remaining <= 1;

  const bg = isExhausted
    ? "rgba(255,69,58,0.12)"
    : isLow
    ? "rgba(255,159,10,0.12)"
    : "var(--m-cream-2)";
  const color = isExhausted
    ? "#ff453a"
    : isLow
    ? "#ff9f0a"
    : "var(--m-ink-soft)";

  return (
    <button
      type="button"
      onClick={onClick}
      title={
        isExhausted
          ? "Daily limit reached — click to add your API key for unlimited use"
          : `${remaining} of ${limit} free requests remaining today. Click to add your own API key.`
      }
      className="flex items-center gap-1 transition-opacity hover:opacity-80 shrink-0"
      style={{
        fontSize: "11px",
        fontWeight: 600,
        padding: "4px 8px",
        borderRadius: "980px",
        background: bg,
        color,
        border: isExhausted ? "1px solid rgba(255,69,58,0.25)" : "none",
        cursor: onClick ? "pointer" : "default",
        whiteSpace: "nowrap",
      }}
    >
      {isExhausted ? (
        <>
          <Key className="w-3 h-3" />
          Add API key
        </>
      ) : (
        <>
          <Zap className="w-3 h-3" />
          {count}/{limit} free
        </>
      )}
    </button>
  );
}
