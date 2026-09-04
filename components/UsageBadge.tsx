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

  // Tones follow components/cc/status-pill.tsx: red for exhausted, burnt for
  // "running low" (DESIGN.md's heat/attention colour). Text is the hue mixed
  // into --m-ink rather than the hue itself — --m-ink is chocolate in light
  // and cream in dark, so lightness tracks the theme by construction and the
  // label stays legible on the tint in both. See that file for the measured
  // ratios behind this formula.
  const bg = isExhausted
    ? "color-mix(in srgb, var(--m-red) 18%, transparent)"
    : isLow
    ? "color-mix(in srgb, var(--m-burnt) 18%, transparent)"
    : "var(--m-cream-2)";
  const color = isExhausted
    ? "color-mix(in srgb, var(--m-red) 50%, var(--m-ink))"
    : isLow
    ? "color-mix(in srgb, var(--m-burnt) 50%, var(--m-ink))"
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
        border: isExhausted ? "1.5px solid color-mix(in srgb, var(--m-red) 28%, transparent)" : "none",
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
