"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

/**
 * Chip — thin wrapper over meshi-b's own `.chip` / `.chip-active`.
 *
 * **BUG FIXED HERE:** the active state used to emit `class="chip active"`, and
 * a bare `.active` rule exists in NO stylesheet the web tree loads. meshi-b's
 * class is `.chip-active`. The selected chip therefore rendered identical to
 * the unselected ones — the admin users page's Status and Platform filters
 * both looked permanently unfiltered.
 *
 * This is the same failure as the `chip-solid` bug the mobile inbox hit: an
 * invented class name is valid HTML that silently styles nothing. It went
 * unnoticed because the only consumer is the admin console, which per the
 * `ADMIN_EMAIL` blocker nobody has ever rendered.
 */
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, active = false, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn("chip", active && "chip-active", className)}
      aria-pressed={active}
      {...props}
    />
  )
);
Chip.displayName = "Chip";
