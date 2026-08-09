import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * wLa runs a four-band rhythm rather than a light/dark alternation:
 * cream → forest → cream → cream-2 → forest → cream → plum → cream → forest.
 * `tone` names the band directly; the deep two share `.band-deep`, which
 * re-scopes the text/accent tokens for a saturated ground.
 */
type Tone = "cream" | "cream2" | "forest" | "plum";

const BAND: Record<Tone, string> = {
  cream: "band-cream",
  cream2: "band-cream2",
  forest: "band-forest band-deep",
  plum: "band-plum band-deep",
};

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  /** Fixed background band, named after the artboard's own sequence */
  tone?: Tone;
  eyebrow?: string;
  headline?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Max content width; defaults to the 980px marketing column */
  wide?: boolean;
}

export function Section({
  tone = "cream",
  eyebrow,
  headline,
  subtitle,
  wide = false,
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn(BAND[tone], "px-6 py-20 md:py-28", className)}
      {...props}
    >
      <div className={cn("mx-auto", wide ? "max-w-[1200px]" : "max-w-[1060px]")}>
        {(eyebrow || headline || subtitle) && (
          <div className="text-center space-y-3 mb-12 md:mb-16">
            {eyebrow && (
              /* `--cc-accent`, NOT `--m-forest`, and that is deliberate. This is
                 the one place the alias layer is still load-bearing: `.band-deep`
                 re-scopes `--cc-accent` to LIME on the forest and plum bands,
                 because forest cannot be both the band and the accent on it.
                 Hardcoding the meshi token would render the eyebrow invisible on
                 two of the landing's four band types. When 10e deletes `--cc-*`,
                 the band mechanism in globals.css has to move to a scoped
                 `--m-*`-named variable FIRST — this is not a stray alias to
                 sweep up. */
              <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--cc-accent)]">
                {eyebrow}
              </p>
            )}
            {headline && (
              <h2 className="headline-section" style={{ color: "inherit" }}>
                {headline}
              </h2>
            )}
            {subtitle && (
              <p className="text-[17px] leading-relaxed opacity-70 max-w-[560px] mx-auto">
                {subtitle}
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
