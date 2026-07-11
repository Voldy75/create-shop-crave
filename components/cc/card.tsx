import * as React from "react";
import { cn } from "@/lib/utils";

export interface CCCardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  /** Adds the standard 1px token border */
  bordered?: boolean;
}

export const CCCard = React.forwardRef<HTMLDivElement, CCCardProps>(
  ({ className, elevated = false, bordered = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl",
        elevated
          ? "bg-[var(--cc-surface-2)] shadow-[var(--cc-shadow-sm)]"
          : "bg-[var(--cc-surface)]",
        bordered && "border border-[var(--cc-border)]",
        className
      )}
      {...props}
    />
  )
);
CCCard.displayName = "CCCard";
