"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, Plug, User, Loader2 } from "lucide-react";
import { AppTopbar } from "@/components/web/AppTopbar";
import { useUser } from "@/app/context/UserContext";
import { useFeatureFlags } from "@/lib/feature-flags";
import { NotificationsSection } from "./sections/NotificationsSection";
import { ConnectionsSection } from "./sections/ConnectionsSection";
import { AccountSection } from "./sections/AccountSection";

/**
 * /settings — rebuilt to artboard w8b.
 *
 * WHAT CHANGED AND WHY. This page kept a `.glass-nav` sticky header with a
 * `router.back()` arrow — a PHONE pattern — inside a layout that already has a
 * persistent sidebar, plus a hand-rolled underline tab bar. It was one of the
 * two screens holding the app's second header convention (the other, /favorites,
 * is now a redirect). It uses the shared AppTopbar and w8b's `.utabs` now.
 *
 * The three sections themselves are untouched: they wire the real push /
 * WhatsApp / Swiggy / notification-preference clients, and this pass is
 * presentation only. What DID change inside them is the row treatment — see
 * NotificationsSection for the `.xrow` + `.xsw` conversion.
 *
 * NOT ADOPTED FROM w8b, because none of it is backed:
 *   - "meshi+ · yearly · ₹2,990 · renews 14 Mar 2027". The real product is
 *     ₹749 charged ONCE for 31 days with nothing rescheduling it — see
 *     lib/billing's renewalNote, and the two separate occasions a paywall
 *     shipped invented prices before this was caught.
 *   - "Removes 42 chats, plans and logs" on the delete-account card. There is
 *     no account-deletion endpoint, so a Delete button would be a dead control.
 *   - The masked phone "+91 98•••• 4412" and the "8:00 pm · IST" send time as
 *     static text — NotificationsSection already renders the user's REAL
 *     enrolment state and nudge preferences.
 */

type Tab = "notifications" | "connections" | "account";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "connections", label: "Connections", icon: Plug },
  { id: "account", label: "Account", icon: User },
];

export default function SettingsPage() {
  // Suspense so useSearchParams doesn't trigger a static-rendering bailout.
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, hydrated } = useUser();
  const { flags, loading: flagsLoading } = useFeatureFlags();

  const requested = params.get("tab");
  const [activeTab, setActiveTab] = useState<Tab>(
    requested === "connections" || requested === "account" ? requested : "notifications"
  );

  useEffect(() => {
    if (hydrated && !user) router.replace("/");
  }, [user, hydrated, router]);

  if (!hydrated || !user) {
    return (
      <main className="mbody">
        <div className="flex items-center justify-center" style={{ height: 240 }}>
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--m-ink-soft)" }} />
        </div>
      </main>
    );
  }

  return (
    <>
      {/* No back arrow: the sidebar is the way out of a top-level screen. */}
      <AppTopbar title="Settings" caption="Notifications, connections and your account" />

      {/* w8b's underline tabs. `.utab` lives in design/meshi-app.css. */}
      <div className="utabs" role="tablist" aria-label="Settings sections">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            className={`utab${activeTab === id ? " is-active" : ""}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon className="w-4 h-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <main className="mbody">
        <div style={{ padding: "24px 32px 40px", maxWidth: 760, margin: "0 auto", width: "100%" }}>
          {activeTab === "notifications" && <NotificationsSection />}
          {activeTab === "connections" && (
            <ConnectionsSection flags={flags} flagsLoading={flagsLoading} />
          )}
          {activeTab === "account" && <AccountSection />}
        </div>
      </main>
    </>
  );
}
