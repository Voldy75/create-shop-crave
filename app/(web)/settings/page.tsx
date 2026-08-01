"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, Plug, User, Loader2 } from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import { useFeatureFlags } from "@/lib/feature-flags";
import { NotificationsSection } from "./sections/NotificationsSection";
import { ConnectionsSection } from "./sections/ConnectionsSection";
import { AccountSection } from "./sections/AccountSection";

type Tab = "notifications" | "connections" | "account";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "connections", label: "Connections", icon: Plug },
  { id: "account", label: "Account", icon: User },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, hydrated } = useUser();
  const { flags, loading: flagsLoading } = useFeatureFlags();
  const [activeTab, setActiveTab] = useState<Tab>("notifications");

  useEffect(() => {
    if (hydrated && !user) router.replace("/");
  }, [user, hydrated, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "connections" || tab === "account" || tab === "notifications") {
      setActiveTab(tab);
    }
  }, []);

  if (!hydrated || !user) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "var(--cc-bg)" }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--cc-text-tertiary)" }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--cc-bg)" }}
    >
      {/* Header */}
      <header
        className="glass-nav px-4 md:px-6 flex items-center gap-3 sticky top-0 z-10"
        style={{ height: "48px" }}
      >
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--cc-surface-2)]"
        >
          <ArrowLeft className="w-4 h-4" style={{ color: "var(--cc-text-secondary)" }} />
        </button>
        <h1
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "var(--cc-text-primary)",
            letterSpacing: "-0.02em",
          }}
        >
          Settings
        </h1>
      </header>

      {/* Tab bar */}
      <div
        className="px-4 md:px-6 flex gap-1 overflow-x-auto"
        style={{
          borderBottom: "1px solid var(--cc-border)",
          background: "var(--cc-bg)",
        }}
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex items-center gap-1.5 px-3 py-2.5 transition-colors shrink-0"
              style={{
                fontSize: "13px",
                fontWeight: active ? 600 : 400,
                color: active ? "var(--cc-accent)" : "var(--cc-text-secondary)",
                borderBottom: active ? "2px solid var(--cc-accent)" : "2px solid transparent",
                marginBottom: "-1px",
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 py-5 max-w-xl mx-auto">
        {activeTab === "notifications" && <NotificationsSection />}
        {activeTab === "connections" && (
          <ConnectionsSection flags={flags} flagsLoading={flagsLoading} />
        )}
        {activeTab === "account" && <AccountSection />}
      </div>
    </div>
  );
}
