"use client";

/**
 * /settings/notifications — redirected onto /settings?tab=notifications.
 *
 * This route was a FULL SECOND COPY of the notifications screen: the same
 * imports, the same state shape, the same push/WhatsApp/test-send wiring, with
 * its own back-arrow header. Two implementations of one screen, reachable from
 * different entry points — the planner's bell came here while the settings tab
 * rendered NotificationsSection. They would have drifted the moment either was
 * touched, which is the same failure `mm-dot` and `.row` both caused.
 *
 * Kept as a redirect rather than deleted because the path is linked from
 * outside this file (the planner bell, /m/profile's two rows, and anything a
 * user has bookmarked). `replace` keeps it out of the back stack.
 */

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function NotificationsRedirect() {
  return (
    <Suspense fallback={null}>
      <NotificationsRedirectInner />
    </Suspense>
  );
}

function NotificationsRedirectInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    // Forward the query string. /api/swiggy/auth/callback lands here with
    // ?connected=1 (or an error code) after the OAuth round trip. Nothing reads
    // those today, but dropping them here would silently change what the
    // callback delivers, and that is not this commit's job.
    const qs = params.toString();
    router.replace(`/settings?tab=notifications${qs ? `&${qs}` : ""}`);
  }, [router, params]);

  return (
    <main className="mbody">
      <div style={{ padding: 32 }}>
        <span className="t-cap">Taking you to notification settings…</span>
      </div>
    </main>
  );
}
