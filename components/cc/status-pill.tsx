import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "active" | "pending" | "off" | "error";

/**
 * Status pill — admin-console state badge.
 *
 * Tones were hardcoded iOS system colours (a green, an amber and a red) with
 * rgba tints — the last Midnight Kitchen palette in this directory. They map
 * onto meshi's semantic tokens instead, matching what the
 * same meanings already use elsewhere in the tree: forest for healthy (the
 * primary), burnt for needs-attention (DESIGN.md's "streaks / heat"), red for
 * error (destructive only), and the plain inset surface for off.
 *
 * `color-mix` rather than fixed tints, because these have to keep working when
 * `[data-theme="dark"]` repaints the tokens underneath them.
 *
 * **Every tone is `hue 50% + --m-ink` on an 18% tint of the same hue, and that
 * uniformity is a contrast requirement rather than tidiness.** This label is
 * 10px — far below the 18.66px large-text threshold — so WCAG AA wants 4.5:1,
 * measured by compositing the tint over the page background.
 *
 * The obvious pairing (hue on a tint of itself) fails in light mode: burnt
 * 3.43, red 3.15, ink-soft-on-cream-2 4.16. But simply darkening to each hue's
 * dark sibling fails in DARK mode instead — `--m-forest-2` and `--m-brown` are
 * dark in both themes, so on a dark surface they measured 1.80 and 2.36.
 *
 * Mixing the hue into `--m-ink` fixes both at once, because `--m-ink` is
 * chocolate in light and cream in dark: the text lightness tracks the theme by
 * construction. Measured — light 7.30 / 5.36 / 10.46 / 5.38, dark 6.03 / 6.71
 * / 12.39 / 6.04. **Re-measure in BOTH themes if you retune these; a value
 * that looks right in one can fail the other outright.**
 */
const TONE_CLASSES: Record<StatusTone, string> = {
  active:
    "text-[color-mix(in_srgb,var(--m-forest)_50%,var(--m-ink))] bg-[color-mix(in_srgb,var(--m-forest)_18%,transparent)]",
  pending:
    "text-[color-mix(in_srgb,var(--m-burnt)_50%,var(--m-ink))] bg-[color-mix(in_srgb,var(--m-burnt)_18%,transparent)]",
  off: "text-[var(--m-ink)] bg-[var(--m-cream-2)]",
  error:
    "text-[color-mix(in_srgb,var(--m-red)_50%,var(--m-ink))] bg-[color-mix(in_srgb,var(--m-red)_18%,transparent)]",
};

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: StatusTone;
}

export function StatusPill({ tone, className, children, ...props }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center shrink-0 rounded-[var(--m-r-pill)] px-[7px] py-[2px] text-[10px] font-extrabold uppercase tracking-[0.04em]",
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
