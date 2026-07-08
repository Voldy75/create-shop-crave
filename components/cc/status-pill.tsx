import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "active" | "pending" | "off" | "error";

const TONE_CLASSES: Record<StatusTone, string> = {
  active: "text-[#34c759] bg-[rgba(52,199,89,0.10)]",
  pending: "text-[#ff9f0a] bg-[rgba(255,159,10,0.10)]",
  off: "text-[var(--cc-text-tertiary)] bg-[var(--cc-surface-2)]",
  error: "text-[#ff453a] bg-[rgba(255,69,58,0.10)]",
};

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: StatusTone;
}

export function StatusPill({ tone, className, children, ...props }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center shrink-0 rounded-[var(--cc-radius-pill)] px-[7px] py-[2px] text-[10px] font-bold uppercase tracking-[0.04em]",
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
