"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { signInWithProvider } from "@/lib/native-auth";
import { Github, Mail, Loader2 } from "lucide-react";

/**
 * Sign-in — built to the Flow "Sign in" artboard (w1b).
 *
 * TWO THINGS THE ARTBOARD SHOWS THAT ARE NOT BUILT, AND WHY:
 *
 *  - "Continue with Apple" is not rendered. `lib/native-auth.ts`'s
 *    `OAuthProvider` type is `"google" | "github"` — Apple is not a supported
 *    provider at the type level, and no Apple Services ID is configured in
 *    Supabase. Rendering the button would be the same mistake as the mobile
 *    paywall selling capability that doesn't exist.
 *  - "New here? Create an account" is not rendered. OAuth sign-in already
 *    creates the account on first login — there is no separate sign-up flow
 *    to link to, so the artboard's line would point nowhere.
 *
 * The magic-link email field IS built, unlike Apple — `supabase.auth
 * .signInWithOtp` needs no new provider credentials, only the Supabase
 * client already used everywhere else. What is NOT verified from here is
 * actual delivery: whether the project's email/SMTP settings will land the
 * mail in an inbox. Same category of caveat as the mobile paywall's iOS path
 * — real code against a real API, infra unverified.
 */
function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export function AuthButton() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = () => { void signInWithProvider(supabase, "google"); };
  const signInWithGitHub = () => { void signInWithProvider(supabase, "github"); };

  const sendMagicLink = async () => {
    if (!email.trim() || sending) return;
    setSending(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    });
    setSending(false);
    if (err) setError(err.message);
    else setSent(true);
  };

  return (
    <div className="vstack" style={{ gap: 10, width: "100%" }}>
      {/* Google keeps the app's own forest primary — the artboard puts the
          provider mark in a cream badge rather than branding the whole
          button per-provider. */}
      <button onClick={signInWithGoogle} className="pill-primary" style={{ width: "100%", gap: 10 }}>
        <span className="prov-badge" style={{ background: "var(--m-on-deep)" }}>
          <GoogleIcon />
        </span>
        Continue with Google
      </button>

      {/* GitHub's own brand black — a partner colour on DESIGN.md's allowlist,
          the same category as Swiggy orange or Zomato red. */}
      <button onClick={signInWithGitHub} className="pill-primary" style={{ width: "100%", gap: 10, background: "#24292F" }}>
        <span className="prov-badge" style={{ background: "var(--m-on-deep)" }}>
          <Github width={13} height={13} style={{ color: "#24292F" }} />
        </span>
        Continue with GitHub
      </button>

      <div className="hstack" style={{ gap: 10, width: "100%", margin: "4px 0" }}>
        <i style={{ flex: 1, height: 1.5, background: "var(--m-ink-faint)" }} />
        <span className="t-cap">or</span>
        <i style={{ flex: 1, height: 1.5, background: "var(--m-ink-faint)" }} />
      </div>

      {sent ? (
        <div className="card tint-green" style={{ boxShadow: "none", padding: "12px 14px", width: "100%", textAlign: "center" }}>
          <span className="t-body" style={{ color: "var(--m-forest-2)" }}>Check {email} for a sign-in link.</span>
        </div>
      ) : (
        <>
          <div className="input" style={{ width: "100%" }}>
            <Mail width={18} height={18} style={{ color: "var(--m-ink-soft)", flex: "none" }} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="grow"
              style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", minWidth: 0 }}
              onKeyDown={(e) => { if (e.key === "Enter") void sendMagicLink(); }}
            />
          </div>
          <button onClick={sendMagicLink} disabled={!email.trim() || sending} className="pill-secondary" style={{ width: "100%", opacity: email.trim() ? 1 : 0.6 }}>
            {sending && <Loader2 width={16} height={16} className="animate-spin" />}
            {sending ? "Sending…" : "Email me a magic link"}
          </button>
          {error && <span className="t-cap" style={{ color: "var(--m-red)" }}>{error}</span>}
        </>
      )}
    </div>
  );
}
