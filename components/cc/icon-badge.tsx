import * as React from "react";
import { cn } from "@/lib/utils";

export interface IconBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ComponentType<{ className?: string }>;
  /** Highlight with the accent tint instead of the neutral inset surface */
  accent?: boolean;
  size?: "sm" | "md";
}

/**
 * Rounded icon tile. The accent variant is meshi's green tint with forest ink —
 * the same pairing `.tab-active .tab-ic` and the sidebar avatar already use, so
 * an "active/highlighted" icon reads the same everywhere in the product.
 */
export function IconBadge({ icon: Icon, accent = false, size = "md", className, ...props }: IconBadgeProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[var(--m-r-tile)]",
        size === "md" ? "w-9 h-9" : "w-7 h-7",
        accent
          ? "bg-[var(--m-tint-green)] text-[var(--m-forest)]"
          : "bg-[var(--m-cream-2)] text-[var(--m-ink-soft)]",
        className
      )}
      {...props}
    >
      <Icon className={size === "md" ? "w-[18px] h-[18px]" : "w-3.5 h-3.5"} />
    </div>
  );
}
