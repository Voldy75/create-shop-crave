/**
 * 404 for notFound() raised inside the web tree.
 *
 * Was pre-meshi — a white ground, generic grey text and an indigo button.
 * See the note in app/(web)/error.tsx for why the hex gate could not catch
 * it, and why the old class names are described rather than quoted here.
 *
 * The numeral reads --figure-accent, NOT --m-forest: this page renders inside
 * the web layout, so it follows the user's theme, and bare forest measures
 * 2.63:1 on the dark ground. app/global-not-found.tsx keeps plain forest
 * because it hardcodes data-theme="light" and can never render dark.
 */

import Link from "next/link";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
        textAlign: "center",
        background: "var(--m-cream)",
        color: "var(--m-ink)",
      }}
    >
      <p
        style={{
          font: "800 56px/1 var(--m-font-display)",
          color: "var(--figure-accent)",
          margin: 0,
        }}
      >
        404
      </p>
      <h1 className="t-d2" style={{ margin: 0 }}>
        Page not found
      </h1>
      <p className="t-body" style={{ color: "var(--m-ink-soft)", maxWidth: 420, margin: 0 }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/" className="pill-primary" style={{ marginTop: 10, textDecoration: "none" }}>
        Go home
      </Link>
    </main>
  );
}
