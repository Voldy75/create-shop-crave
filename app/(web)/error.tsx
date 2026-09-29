"use client";

/**
 * Error boundary for the web tree.
 *
 * Was pre-meshi: a white ground, generic grey body text, a red-tinted icon
 * chip, and an INDIGO button — indigo belongs to no palette this project has
 * ever had, so this screen was off-brand through Midnight Kitchen AND meshi.
 * (The old class names are described rather than quoted: Tailwind's content
 * scanner reads comments, so quoting them compiles dead rules and pollutes
 * the grep audit described below.)
 *
 * WHY IT SURVIVED EVERY CONVERSION AND EVERY GATE: `npm run check:hex` only
 * catches hex and rgba LITERALS. These were Tailwind utility CLASS NAMES, so
 * the gate was structurally blind to them and CI stayed green. Any screen
 * written with off-palette utilities can drift the same way — grep for
 * `bg-`/`text-` colour utilities, not just hex, when auditing a surface.
 *
 * Renders inside app/(web)/layout.tsx, so meshi-b + meshi-a11y + globals are
 * all loaded and the meshi component classes are available.
 */

import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: 24,
        textAlign: "center",
        background: "var(--m-cream)",
        color: "var(--m-ink)",
      }}
    >
      <span
        className="icon-btn tint-peach"
        style={{ boxShadow: "none", width: 56, height: 56, color: "var(--text-burnt)" }}
        aria-hidden
      >
        <AlertCircle width={26} height={26} />
      </span>

      <h1 className="t-d2" style={{ margin: 0 }}>
        Something went wrong
      </h1>
      <p className="t-body" style={{ color: "var(--m-ink-soft)", maxWidth: 420, margin: 0 }}>
        An unexpected error occurred. Trying again usually clears it.
      </p>

      <div className="hstack" style={{ gap: 10, marginTop: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <button type="button" onClick={reset} className="pill-primary">
          Try again
        </button>
        <Link href="/" className="pill-secondary" style={{ textDecoration: "none" }}>
          Go home
        </Link>
      </div>
    </main>
  );
}
