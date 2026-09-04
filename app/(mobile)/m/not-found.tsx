import Link from "next/link";

/**
 * 404 for the mobile tree. Lives under /m so it renders inside the .cc token
 * wrapper from app/(mobile)/m/layout.tsx and picks up meshi styling — the web
 * 404 at app/(web)/not-found.tsx is Tailwind-styled and would look wrong here.
 */
export default function MobileNotFound() {
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
      }}
    >
      <div className="t-display" aria-hidden>
        404
      </div>
      <h2 className="t-h2">This page moved on</h2>
      <p className="t-body" style={{ opacity: 0.7, maxWidth: 320 }}>
        We couldn&apos;t find what you were looking for.
      </p>
      <Link href="/m" className="pill-primary" style={{ marginTop: 12 }}>
        Back to home
      </Link>
    </main>
  );
}
