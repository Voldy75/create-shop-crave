/**
 * Where a deleted account lands on mobile, signed out — F10 10e.
 *
 * The board puts this on the welcome screen with a banner. It is its own route
 * so the onboarding flow does not have to carry a deletion state, but it keeps
 * 10e's shape: a confirmation banner, the wordmark, and the two ways back in.
 * Copy matches what actually happened (see lib/account-client.ts): this
 * device's data was cleared, other devices keep their own copy.
 */

import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { BoBowl } from "@/components/mascots";
import { GoogleSignInButton } from "@/components/mobile/GoogleSignInButton";

export const metadata = { title: "Account deleted — meshi" };

export default function MobileAccountDeletedPage() {
  return (
    <div
      className="vstack"
      style={{
        minHeight: "100dvh",
        background: "var(--m-cream)",
        padding: "calc(env(safe-area-inset-top, 12px) + 14px) 22px calc(env(safe-area-inset-bottom, 0px) + 26px)",
        gap: 14,
      }}
    >
      <div className="hstack" role="status" style={{ gap: 10, padding: "12px 14px", borderRadius: 16, background: "var(--m-tint-green)" }}>
        <CircleCheck width={20} height={20} style={{ color: "var(--figure-accent)", flex: "none" }} aria-hidden />
        <span className="t-body">Your account and its data were deleted. You’re signed out.</span>
      </div>

      <div className="grow" />

      <div className="vstack" style={{ gap: 10, alignItems: "center", textAlign: "center" }}>
        <BoBowl width={84} height={84} aria-hidden />
        <span className="t-d1">meshi</span>
        <span className="t-body-soft" style={{ maxWidth: 300 }}>
          Signing in with the same Google account starts a new, empty account.
        </span>
        <span className="t-cap" style={{ maxWidth: 300 }}>
          Other phones or browsers you used keep their own copy until you sign out there.
        </span>
      </div>

      <div className="grow" />

      <Link href="/m/onboarding" className="pill-primary" style={{ textDecoration: "none", justifyContent: "center" }}>
        Get started
      </Link>
      <div className="vstack" style={{ gap: 6, alignItems: "center" }}>
        <GoogleSignInButton />
      </div>
    </div>
  );
}
