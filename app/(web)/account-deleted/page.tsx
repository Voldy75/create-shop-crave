/**
 * Where a deleted account lands, signed out — built to w11e.
 *
 * Copy is held to what actually happened: the account and the server data
 * cascaded with it are gone, THIS browser's local copy was cleared, and the
 * session ended. It does not claim to have reached other devices, which keep
 * their own local copy (see lib/account-client.ts).
 */

import Link from "next/link";
import { Check } from "lucide-react";
import { BoBowl } from "@/components/mascots";

export const metadata = { title: "Account deleted — meshi" };

export default function AccountDeletedPage() {
  return (
    <main style={{ minHeight: "100dvh", background: "var(--m-cream)", color: "var(--m-ink)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "20px 34px", borderBottom: "1px solid var(--m-ink-faint)", background: "var(--m-card)" }}>
        <div className="side-logo" style={{ padding: 0, margin: 0 }}>
          <BoBowl width={36} height={36} aria-hidden />
          meshi
        </div>
        <div className="grow" />
        <Link href="/" className="chip" style={{ textDecoration: "none" }}>
          Sign in
        </Link>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <div className="vstack" style={{ gap: 14, maxWidth: 520, alignItems: "center", textAlign: "center" }}>
          <span
            aria-hidden
            style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--m-tint-green)", color: "var(--figure-accent)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Check width={30} height={30} />
          </span>
          <h1 className="t-d1" style={{ margin: 0, fontSize: 34 }}>Your account has been deleted</h1>
          <span className="t-body-soft">
            Your account and everything we held for it — meal logs, goals, notification subscriptions and any connected
            store account — are gone. This browser’s saved recipes, preferences and chat history were cleared, and
            you’ve been signed out.
          </span>
          <span className="t-cap">
            Signing in again with the same Google account starts a new, empty meshi account. Other browsers or phones
            you used keep their own copy until you sign out there.
          </span>
          <Link href="/" className="xbtn xbtn-f" style={{ marginTop: 8, textDecoration: "none" }}>
            Go to meshi
          </Link>
        </div>
      </div>
    </main>
  );
}
