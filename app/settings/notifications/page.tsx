"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, MessageCircle, Lock, Info, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/app/context/UserContext";
import { getMySubscription, upsertMySubscription } from "@/lib/notifications-client";
import { enableWebPush, disableWebPush, isPushSupported, pushPermission, sendTestPush } from "@/lib/push-client";
import type { NotificationSubscription } from "@/lib/types";

/**
 * Settings page for daily-nudge channels. PR A scope: UI shell with toggles
 * that persist to notification_subscriptions, but no actual push/WhatsApp
 * wiring. PR B wires web push subscribe/send; PR C wires WhatsApp opt-in;
 * PR D adds the cron that actually fires nudges.
 */
export default function NotificationsSettingsPage() {
  const router = useRouter();
  const { user, hydrated } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sub, setSub] = useState<NotificationSubscription | null>(null);
  const [testing, setTesting] = useState(false);
  const [pushSupport, setPushSupport] = useState<{ supported: boolean; permission: string }>({
    supported: false,
    permission: "unsupported",
  });

  useEffect(() => {
    setPushSupport({ supported: isPushSupported(), permission: pushPermission() });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getMySubscription().then((s) => {
      if (cancelled) return;
      setSub(s);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user, hydrated]);

  const toggle = async (channel: "webPush" | "whatsapp") => {
    if (!sub && !user) return;
    setSaving(true);
    try {
      if (channel === "webPush") {
        const willEnable = !(sub?.webPushEnabled ?? false);
        if (willEnable) {
          if (!pushSupport.supported) {
            toast("This browser doesn't support push. On iOS, install the PWA first.");
            return;
          }
          const result = await enableWebPush();
          if (!result.ok) {
            toast(
              result.reason === "permission_denied"
                ? "Browser permission is blocked. Allow notifications in site settings."
                : result.reason === "permission_dismissed"
                  ? "Permission needed to send notifications."
                  : result.reason === "missing_vapid"
                    ? "Server not configured for push yet."
                    : "Couldn't enable push — try again.",
            );
            return;
          }
          // /api/notifications/push/subscribe already persisted the row; refresh local view.
          setSub(await getMySubscription());
          toast("Web push enabled");
        } else {
          await disableWebPush();
          setSub(await getMySubscription());
          toast("Web push turned off");
        }
        setPushSupport({ supported: isPushSupported(), permission: pushPermission() });
      } else {
        // WhatsApp wiring lands in PR C; for now this just flips the preference flag.
        const patch = { whatsappEnabled: !(sub?.whatsappEnabled ?? false) };
        const next = await upsertMySubscription(patch);
        if (next) setSub(next);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    setTesting(true);
    try {
      const result = await sendTestPush();
      toast(result.ok ? "Test push sent — check your notifications." : `Test failed: ${result.reason}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--cc-bg)", color: "var(--cc-text-primary)" }}>
      <header
        className="glass-nav px-6 flex items-center gap-4 sticky top-0 z-10"
        style={{ height: "48px" }}
      >
        <button
          onClick={() => router.push("/planner")}
          className="p-2 rounded-full transition-opacity hover:opacity-70"
          style={{ color: "var(--cc-text-secondary)" }}
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 style={{ fontSize: "14px", fontWeight: 400, color: "var(--cc-text-primary)" }}>
          Notifications
        </h1>
      </header>

      <main className="max-w-[680px] mx-auto p-6 space-y-6">
        {!user && hydrated ? (
          <SignedOutNotice />
        ) : loading ? (
          <SkeletonCard />
        ) : (
          <>
            <Intro />

            <ChannelCard
              icon={Bell}
              title="Web push"
              subtitle="Browser notifications. Free, works on Android + installed PWAs on iOS."
              enabled={sub?.webPushEnabled ?? false}
              status={sub?.webPushEnabled ? "Active" : "Off"}
              tone={sub?.webPushEnabled ? "active" : "off"}
              saving={saving}
              onToggle={() => toggle("webPush")}
              detail={
                <div>
                  {!pushSupport.supported && (
                    <p style={{ fontSize: "12px", color: "#ff9f0a" }}>
                      This browser doesn&apos;t support web push. On iOS, install the PWA first
                      (Add to Home Screen).
                    </p>
                  )}
                  {pushSupport.supported && pushSupport.permission === "denied" && (
                    <p style={{ fontSize: "12px", color: "#ff453a" }}>
                      Permission blocked. Allow notifications in your browser&apos;s site settings.
                    </p>
                  )}
                  {sub?.webPushEnabled && (
                    <button
                      onClick={handleSendTest}
                      disabled={testing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 transition-colors"
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        background: "var(--cc-surface-2)",
                        color: "var(--cc-text-primary)",
                        border: "1px solid var(--cc-border)",
                        borderRadius: "980px",
                        marginTop: "4px",
                      }}
                    >
                      {testing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" /> Send test
                        </>
                      )}
                    </button>
                  )}
                </div>
              }
            />

            <ChannelCard
              icon={MessageCircle}
              title="WhatsApp"
              subtitle="Daily nudge via Twilio Sandbox. You'll join by texting a code."
              enabled={sub?.whatsappEnabled ?? false}
              status={
                sub?.whatsappStatus === "active"
                  ? "Connected"
                  : sub?.whatsappStatus === "pending"
                    ? "Pending join"
                    : sub?.whatsappEnabled
                      ? "Awaiting phone"
                      : "Off"
              }
              tone={sub?.whatsappStatus === "active" ? "active" : sub?.whatsappEnabled ? "pending" : "off"}
              saving={saving}
              onToggle={() => toggle("whatsapp")}
              detail={
                <p style={{ fontSize: "12px", color: "var(--cc-text-tertiary)" }}>
                  Phone entry + JOIN flow lands in the next release. Toggle persists today.
                </p>
              }
            />

            <FreeTierNote />
          </>
        )}
      </main>
    </div>
  );
}

function Intro() {
  return (
    <div
      className="p-5"
      style={{
        background: "var(--cc-surface)",
        border: "1px solid var(--cc-border)",
        borderRadius: "16px",
      }}
    >
      <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--cc-text-primary)" }}>
        Daily nudges
      </h2>
      <p style={{ fontSize: "13px", color: "var(--cc-text-secondary)", marginTop: "6px", lineHeight: 1.5 }}>
        Get a personalised diet suggestion at 8pm IST based on what you logged today and your goal.
        Choose any combination of channels.
      </p>
    </div>
  );
}

interface ChannelCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  enabled: boolean;
  status: string;
  tone: "active" | "pending" | "off";
  saving: boolean;
  onToggle: () => void;
  detail: React.ReactNode;
}

const STATUS_TONE: Record<ChannelCardProps["tone"], { color: string; bg: string }> = {
  active: { color: "#34c759", bg: "rgba(52,199,89,0.10)" },
  pending: { color: "#ff9f0a", bg: "rgba(255,159,10,0.10)" },
  off: { color: "var(--cc-text-tertiary)", bg: "var(--cc-surface-2)" },
};

function ChannelCard({ icon: Icon, title, subtitle, enabled, status, tone, saving, onToggle, detail }: ChannelCardProps) {
  const t = STATUS_TONE[tone];
  return (
    <div
      className="p-5"
      style={{
        background: "var(--cc-surface)",
        border: "1px solid var(--cc-border)",
        borderRadius: "16px",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 flex items-center justify-center"
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: "var(--cc-surface-2)",
            color: "var(--cc-text-secondary)",
          }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--cc-text-primary)" }}>{title}</h3>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: t.color,
                background: t.bg,
                padding: "3px 8px",
                borderRadius: "980px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                flexShrink: 0,
              }}
            >
              {status}
            </span>
          </div>
          <p style={{ fontSize: "12px", color: "var(--cc-text-secondary)", marginTop: "4px", lineHeight: 1.4 }}>
            {subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 gap-3">
        <div>{detail}</div>
        <Switch checked={enabled} onClick={onToggle} disabled={saving} />
      </div>
    </div>
  );
}

function Switch({ checked, onClick, disabled }: { checked: boolean; onClick: () => void; disabled: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onClick}
      disabled={disabled}
      className="relative transition-colors flex-shrink-0"
      style={{
        width: "44px",
        height: "26px",
        borderRadius: "999px",
        background: checked ? "var(--cc-accent)" : "var(--cc-surface-2)",
        border: "1px solid var(--cc-border)",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "wait" : "pointer",
      }}
    >
      <span
        className="absolute"
        style={{
          top: "2px",
          left: checked ? "20px" : "2px",
          width: "20px",
          height: "20px",
          borderRadius: "999px",
          background: "#fff",
          transition: "left 0.18s ease-out",
        }}
      />
    </button>
  );
}

function FreeTierNote() {
  return (
    <div
      className="p-4 flex items-start gap-3"
      style={{
        background: "rgba(10,132,255,0.06)",
        border: "1px solid rgba(10,132,255,0.20)",
        borderRadius: "12px",
        color: "var(--cc-text-secondary)",
      }}
    >
      <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#0a84ff" }} />
      <div>
        <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--cc-text-primary)" }}>
          Free-tier limits
        </p>
        <p style={{ fontSize: "11px", marginTop: "4px", lineHeight: 1.5 }}>
          Web push is free forever. WhatsApp goes through Twilio Sandbox during this beta —
          delivery may pause if you don&apos;t reply for 24+ hours, and the project has a small
          monthly message budget. We&apos;ll tell you if either limit hits.
        </p>
      </div>
    </div>
  );
}

function SignedOutNotice() {
  return (
    <div
      className="flex flex-col items-center text-center px-6 py-16"
      style={{
        background: "var(--cc-surface)",
        border: "1px solid var(--cc-border)",
        borderRadius: "16px",
        color: "var(--cc-text-secondary)",
      }}
    >
      <Lock className="w-6 h-6" style={{ color: "var(--cc-text-tertiary)", marginBottom: "10px" }} />
      <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--cc-text-primary)" }}>
        Sign in to manage notifications
      </h3>
      <p style={{ fontSize: "13px", marginTop: "6px", maxWidth: "340px" }}>
        Channels are stored per account so your phone never lives in the browser.
      </p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="space-y-6">
      {[210, 140, 140].map((h, i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            height: `${h}px`,
            background: "var(--cc-surface)",
            border: "1px solid var(--cc-border)",
            borderRadius: "16px",
          }}
        />
      ))}
    </div>
  );
}
