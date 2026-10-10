"use client";

/**
 * Error boundary for the mobile tree. Lives under /m so it renders inside the
 * .cc token wrapper from app/(mobile)/m/layout.tsx and picks up meshi styling.
 */
export default function MobileError({
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
        gap: 12,
        padding: 24,
        textAlign: "center",
      }}
    >
      <h2 className="t-h2">Something went wrong</h2>
      <p className="t-body" style={{ opacity: 0.7, maxWidth: 320 }}>
        An unexpected error occurred. Please try again.
      </p>
      <button type="button" onClick={reset} className="pill-primary" style={{ marginTop: 12 }}>
        Try again
      </button>
    </main>
  );
}
