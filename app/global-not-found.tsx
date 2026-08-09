import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
/**
 * meshi-b.css MUST be imported here, not just globals.css. globals.css
 * references the meshi tokens directly (the alias layer this comment used to
 * describe was deleted in Phase 10e), so without the design system loaded
 * every token on this page resolves to nothing and the 404 renders unstyled.
 */
import "../design/meshi-b.css";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

/**
 * 404 for URLs that match NO route group.
 *
 * Splitting into two root layouts (app/(web) and app/(mobile)) means an
 * unmatched top-level URL has no root layout to render inside, so Next falls
 * back to its own built-in 404 page. Before the split, app/not-found.tsx was
 * the root not-found and caught these.
 *
 * global-not-found renders outside every layout, so it must return the whole
 * document itself — <html> and <body> included.
 *
 * The per-group not-found files still handle notFound() raised inside a tree:
 *   app/(web)/not-found.tsx     — web routes
 *   app/(mobile)/m/not-found.tsx — mobile routes, inside the .cc token wrapper
 */
export const metadata: Metadata = {
  title: "Page not found — Crave & Create",
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={montserrat.variable} data-theme="light">
      <body className={montserrat.className}>
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
          <p style={{ fontSize: 56, fontWeight: 700, color: "var(--m-forest)", margin: 0 }}>404</p>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Page not found</h1>
          <p style={{ color: "var(--m-ink-soft)", maxWidth: 380, margin: 0 }}>
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <a
            href="/"
            style={{
              marginTop: 12,
              display: "inline-flex",
              alignItems: "center",
              height: 44,
              padding: "0 22px",
              borderRadius: "var(--m-r-pill)",
              background: "var(--m-forest)",
              color: "var(--m-on-deep)",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Go home
          </a>
        </main>
      </body>
    </html>
  );
}
