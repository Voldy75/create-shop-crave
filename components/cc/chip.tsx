"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, active = false, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "chip",
        active && "active",
        className
      )}
      aria-pressed={active}
      {...props}
    />
  )
);
Chip.displayName = "Chip";
