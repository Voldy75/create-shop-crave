import * as React from "react";
import { cn } from "@/lib/utils";

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  /** Fixed background band; sections alternate on the landing page */
  tone?: "dark" | "light";
  eyebrow?: string;
  headline?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Max content width; defaults to the 980px marketing column */
  wide?: boolean;
}

export function Section({
  tone = "dark",
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
      className={cn(
        tone === "dark" ? "section-dark" : "section-light",
        "px-6 py-20 md:py-28",
        className
      )}
      {...props}
    >
      <div className={cn("mx-auto", wide ? "max-w-[1200px]" : "max-w-[980px]")}>
        {(eyebrow || headline || subtitle) && (
          <div className="text-center space-y-3 mb-12 md:mb-16">
            {eyebrow && (
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
