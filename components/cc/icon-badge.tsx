import * as React from "react";
import { cn } from "@/lib/utils";

export interface IconBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ComponentType<{ className?: string }>;
  /** Highlight with the accent color instead of neutral surface */
  accent?: boolean;
  size?: "sm" | "md";
}

export function IconBadge({ icon: Icon, accent = false, size = "md", className, ...props }: IconBadgeProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[var(--cc-radius-md)]",
        size === "md" ? "w-9 h-9" : "w-7 h-7",
        accent
          ? "bg-[var(--cc-accent-dim)] text-[var(--cc-accent)]"
          : "bg-[var(--cc-surface-2)] text-[var(--cc-text-secondary)]",
        className
      )}
      {...props}
    >
      <Icon className={size === "md" ? "w-[18px] h-[18px]" : "w-3.5 h-3.5"} />
    </div>
  );
}
