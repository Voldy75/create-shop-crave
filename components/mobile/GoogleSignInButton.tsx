"use client";

/**
 * A button that genuinely signs in with Google — the same call onboarding's
 * last step makes — for screens that offer "Sign in with Google" outside the
 * onboarding flow (10e, after an account is deleted). Linking to onboarding
 * instead would have dropped the user at its first step under a sign-in label.
 */

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { signInWithProvider } from "@/lib/native-auth";

export function GoogleSignInButton({ next = "/m?welcome=1", className = "chip" }: { next?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={busy}
        aria-busy={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const { error: e } = await signInWithProvider(createClient(), "google", next);
          // On success the page navigates away (web) or the system browser
          // opens (native); only a failure lands back here.
          if (e) {
            setError(e);
            setBusy(false);
          }
        }}
      >
        {busy ? "Opening Google…" : "Sign in with Google"}
      </button>
      {error && (
        <span className="t-cap" role="alert" style={{ color: "var(--text-red)", textAlign: "center" }}>
          Couldn’t sign in — {error}
        </span>
      )}
    </>
  );
}
