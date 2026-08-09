"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Admin-console button.
 *
 * **Why this is not just meshi's `.pill-primary`.** That class is a 52px hero
 * pill (38px as `.pill-sm`), which is right for a marketing CTA and wrong for
 * a dense admin table where several of these sit in a row. The size scale is
 * kept and the SKIN moved onto meshi: forest primary, the chunky sticker press
 * from DESIGN.md's motion section, and `--m-red` for destructive — replacing a
 * hardcoded iOS red and its rgba tint, the last Midnight Kitchen colour in
 * this file.
 *
 * The press is `translateY` against a hard bottom shadow rather than the old
 * `active:scale-[0.98]`, so it matches every other button in the product.
 */
const ccButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer rounded-[var(--m-r-pill)] font-bold transition-[transform,box-shadow,background,border-color,color] duration-150 disabled:pointer-events-none disabled:opacity-60 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--m-forest)] text-[var(--m-on-deep)] shadow-[0_4px_0_var(--m-forest-2)] active:translate-y-[3px] active:shadow-[0_1px_0_var(--m-forest-2)] active:bg-[var(--m-forest-2)]",
        secondary:
          "bg-transparent text-[var(--m-ink)] shadow-[inset_0_0_0_1.5px_var(--m-ink-faint)] hover:bg-[var(--m-cream-2)] active:translate-y-[2px]",
        ghost:
          "bg-transparent text-[var(--m-ink-soft)] hover:bg-[var(--m-cream-2)] hover:text-[var(--m-ink)] active:translate-y-[2px]",
        destructive:
          "bg-transparent text-[var(--m-red)] hover:bg-[color-mix(in_srgb,var(--m-red)_10%,transparent)] active:translate-y-[2px]",
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
