"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const ccButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer rounded-[var(--cc-radius-pill)] font-medium transition-[background,border-color,color,transform] duration-150 disabled:pointer-events-none disabled:opacity-60 active:scale-[0.98] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--cc-accent)] text-white hover:bg-[var(--cc-accent-hover)]",
        secondary:
          "bg-transparent text-[var(--cc-text-primary)] border border-[var(--cc-border-strong)] hover:bg-[var(--cc-surface-2)] hover:border-[var(--cc-text-tertiary)]",
        ghost:
          "bg-transparent text-[var(--cc-text-secondary)] hover:bg-[var(--cc-surface-2)] hover:text-[var(--cc-text-primary)]",
        destructive:
          "bg-transparent text-[var(--cc-text-secondary)] hover:bg-[rgba(255,69,58,0.1)] hover:text-[#ff453a]",
      },
      size: {
        sm: "text-xs px-3 py-1.5 min-h-8",
        md: "text-sm px-4 py-2 min-h-10",
        lg: "text-[17px] px-7 py-3 min-h-12",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface CCButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof ccButtonVariants> {}

export const CCButton = React.forwardRef<HTMLButtonElement, CCButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(ccButtonVariants({ variant, size }), className)}
      {...props}
    />
  )
);
CCButton.displayName = "CCButton";
