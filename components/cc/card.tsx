import * as React from "react";
import { cn } from "@/lib/utils";

export interface CCCardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  /** Adds the standard hairline border */
  bordered?: boolean;
}

/**
 * Admin-console card.
 *
 * Deliberately NOT meshi-b's `.card` class: `.band-deep .card` re-scopes the
 * text tokens for cards sitting on a deep marketing band (see globals.css), so
 * adopting the class here would drag landing-page behaviour into the admin
 * tree. The SURFACE is meshi's — `--m-card` raised, `--m-cream-2` inset, the
 * 20px card radius and the hard 2px shadow — without the band coupling.
 *
 * Note `elevated` inverts what you might expect: an elevated card uses the
 * INSET surface plus a shadow, which is how the admin tables already read.
 * Kept as-is so this stays a re-skin rather than a silent layout change.
 */
export const CCCard = React.forwardRef<HTMLDivElement, CCCardProps>(
  ({ className, elevated = false, bordered = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[var(--m-r-card)]",
        elevated
          ? "bg-[var(--m-cream-2)] shadow-[var(--m-shadow)]"
          : "bg-[var(--m-card)]",
        bordered && "border border-[var(--m-ink-faint)]",
        className
      )}
      {...props}
    />
  )
);
CCCard.displayName = "CCCard";
