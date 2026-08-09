"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, MessageCircle, Lock, Info, Send, Loader2, Copy, Utensils, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/app/context/UserContext";
import { getMySubscription, upsertMySubscription } from "@/lib/notifications-client";
import { enableWebPush, disableWebPush, isPushSupported, pushPermission, sendTestPush } from "@/lib/push-client";
import { enrollWhatsApp, disableWhatsApp, sendWhatsAppTest, type JoinInstructions } from "@/lib/whatsapp-client";
import { getSwiggyStatus, startSwiggyAuth, disconnectSwiggy, type SwiggyStatus } from "@/lib/swiggy-client";
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
  const [phoneInput, setPhoneInput] = useState("");
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [joinInstructions, setJoinInstructions] = useState<JoinInstructions | null>(null);
  const [wTesting, setWTesting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [swiggy, setSwiggy] = useState<SwiggyStatus | null>(null);
  const [swiggyBusy, setSwiggyBusy] = useState(false);

  useEffect(() => {
    setPushSupport({ supported: isPushSupported(), permission: pushPermission() });
    // Honor ?connected=1 / ?error=… from the OAuth callback redirect.
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") {
      toast("Swiggy connected ✓");
      // Clean the URL so a refresh doesn't re-toast.
      window.history.replaceState({}, "", "/settings/notifications");
    } else if (params.get("error")) {
      toast(`Swiggy connect failed: ${params.get("error")}`);
      window.history.replaceState({}, "", "/settings/notifications");
    }
    void refreshSwiggy();
  }, []);

  const refreshSwiggy = async () => {
    const status = await getSwiggyStatus();
    setSwiggy(status);
  };

  const handleSwiggyConnect = async () => {
    setSwiggyBusy(true);
    const result = await startSwiggyAuth();
    if (!result.ok) {
      toast(`Couldn't start Swiggy auth: ${result.reason}`);
      setSwiggyBusy(false);
    }
    // On success the browser is already redirecting — no further state needed.
  };

  const handleSwiggyDisconnect = async () => {
    setSwiggyBusy(true);
    try {
      await disconnectSwiggy();
      await refreshSwiggy();
      toast("Swiggy disconnected");
    } finally {
      setSwiggyBusy(false);
    }
  };

  // While the user is in 'pending' state (we showed them the JOIN code,
  // waiting for the webhook to confirm), poll the subscription every 5s so the
  // UI can flip to 'active' automatically when they complete the WhatsApp join.
  useEffect(() => {
    if (sub?.whatsappStatus !== "pending") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = setInterval(async () => {
      const next = await getMySubscription();
      if (next && next.whatsappStatus !== "pending") {
        setSub(next);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        if (next.whatsappStatus === "active") {
          toast("WhatsApp connected ✓");
        }
      }
    }, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sub?.whatsappStatus]);

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
        const willEnable = !(sub?.whatsappEnabled ?? false);
        if (willEnable) {
          // Don't auto-enable on a fresh user — they need to provide a phone first.
          // If they already have one and just revoked, re-enable inline.
          if (sub?.phoneE164) {
            const patch = { whatsappEnabled: true };
            const next = await upsertMySubscription(patch);
            if (next) setSub(next);
            toast(
              sub.whatsappStatus === "active"
                ? "WhatsApp turned on"
                : "WhatsApp turned on — complete the JOIN step below",
            );
          } else {
            // Just flip the enabled flag; the JOIN form is rendered when enabled+!phone.
            const patch = { whatsappEnabled: true };
            const next = await upsertMySubscription(patch);
            if (next) setSub(next);
          }
        } else {
          await disableWhatsApp();
          setSub(await getMySubscription());
          toast("WhatsApp turned off");
        }
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

  const handleEnroll = async () => {
    setEnrollLoading(true);
    try {
      const result = await enrollWhatsApp(phoneInput);
      if (!result.ok) {
        toast(result.reason || "Couldn't enroll");
        return;
      }
      setJoinInstructions(result.joinInstructions || null);
      setSub(await getMySubscription());
      toast("Phone saved — complete the JOIN step on WhatsApp");
    } finally {
      setEnrollLoading(false);
    }
  };

  const handleResendJoin = async () => {
    // If user wants to see instructions again after closing them, just re-display.
    if (sub?.phoneE164 && !joinInstructions) {
      const result = await enrollWhatsApp(sub.phoneE164);
      if (result.ok) setJoinInstructions(result.joinInstructions || null);
    }
  };

  const handleWhatsAppTest = async () => {
    setWTesting(true);
    try {
      const result = await sendWhatsAppTest();
      if (result.ok) {
        toast("Test WhatsApp sent — check your chat.");
      } else if (result.channelClosed) {
        toast("Session closed — re-send the JOIN code from your phone, then try again.");
        setSub(await getMySubscription());
      } else {
        toast(`Test failed: ${result.reason}`);
      }
    } finally {
      setWTesting(false);
    }
  };

  const copyJoinText = async () => {
    if (!joinInstructions) return;
    try {
      await navigator.clipboard.writeText(joinInstructions.text);
      toast("Copied — paste in WhatsApp");
    } catch {
      toast("Copy failed — long-press to copy");
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--m-cream)", color: "var(--m-ink)" }}>
      <header
        className="glass-nav px-6 flex items-center gap-4 sticky top-0 z-10"
        style={{ height: "48px" }}
      >
        <button
          onClick={() => router.push("/planner")}
          className="p-2 rounded-full transition-opacity hover:opacity-70"
          style={{ color: "var(--m-ink-soft)" }}
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 style={{ fontSize: "14px", fontWeight: 400, color: "var(--m-ink)" }}>
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
                    <p style={{ fontSize: "12px", color: "color-mix(in srgb, var(--m-burnt) 50%, var(--m-ink))" }}>
                      This browser doesn&apos;t support web push. On iOS, install the PWA first
                      (Add to Home Screen).
                    </p>
                  )}
                  {pushSupport.supported && pushSupport.permission === "denied" && (
                    <p style={{ fontSize: "12px", color: "var(--m-red)" }}>
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
                        background: "var(--m-cream-2)",
                        color: "var(--m-ink)",
                        border: "1px solid var(--m-ink-faint)",
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
                <WhatsAppDetail
                  sub={sub}
                  phoneInput={phoneInput}
                  setPhoneInput={setPhoneInput}
                  enrollLoading={enrollLoading}
                  joinInstructions={joinInstructions}
                  onEnroll={handleEnroll}
                  onResendJoin={handleResendJoin}
                  onTest={handleWhatsAppTest}
                  testing={wTesting}
                  onCopyJoin={copyJoinText}
                />
              }
            />

            <SwiggyCard
              status={swiggy}
              busy={swiggyBusy}
              onConnect={handleSwiggyConnect}
              onDisconnect={handleSwiggyDisconnect}
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
        background: "var(--m-card)",
        border: "1px solid var(--m-ink-faint)",
        borderRadius: "16px",
      }}
    >
      <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--m-ink)" }}>
        Daily nudges
      </h2>
      <p style={{ fontSize: "13px", color: "var(--m-ink-soft)", marginTop: "6px", lineHeight: 1.5 }}>
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
  active: {
    color: "color-mix(in srgb, var(--m-forest) 50%, var(--m-ink))",
    bg: "color-mix(in srgb, var(--m-forest) 18%, transparent)",
  },
  pending: {
    color: "color-mix(in srgb, var(--m-burnt) 50%, var(--m-ink))",
    bg: "color-mix(in srgb, var(--m-burnt) 18%, transparent)",
  },
  off: { color: "var(--m-ink-soft)", bg: "var(--m-cream-2)" },
};

function ChannelCard({ icon: Icon, title, subtitle, enabled, status, tone, saving, onToggle, detail }: ChannelCardProps) {
  const t = STATUS_TONE[tone];
  return (
    <div
      className="p-5"
      style={{
        background: "var(--m-card)",
        border: "1px solid var(--m-ink-faint)",
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
            background: "var(--m-cream-2)",
            color: "var(--m-ink-soft)",
          }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--m-ink)" }}>{title}</h3>
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
          <p style={{ fontSize: "12px", color: "var(--m-ink-soft)", marginTop: "4px", lineHeight: 1.4 }}>
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
        background: checked ? "var(--m-forest)" : "var(--m-cream-2)",
        border: "1px solid var(--m-ink-faint)",
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
          background: "var(--m-card)",
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
        background: "color-mix(in srgb, var(--m-plum) 8%, transparent)",
        border: "1.5px solid color-mix(in srgb, var(--m-plum) 22%, transparent)",
        borderRadius: "12px",
        color: "var(--m-ink-soft)",
      }}
    >
      <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--m-plum)" }} />
      <div>
        <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--m-ink)" }}>
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
        background: "var(--m-card)",
        border: "1px solid var(--m-ink-faint)",
        borderRadius: "16px",
        color: "var(--m-ink-soft)",
      }}
    >
      <Lock className="w-6 h-6" style={{ color: "var(--m-ink-soft)", marginBottom: "10px" }} />
      <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--m-ink)" }}>
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
            background: "var(--m-card)",
            border: "1px solid var(--m-ink-faint)",
            borderRadius: "16px",
          }}
        />
      ))}
    </div>
  );
}

interface WhatsAppDetailProps {
  sub: NotificationSubscription | null;
  phoneInput: string;
  setPhoneInput: (v: string) => void;
  enrollLoading: boolean;
  joinInstructions: JoinInstructions | null;
  onEnroll: () => void;
  onResendJoin: () => void;
  onTest: () => void;
  testing: boolean;
  onCopyJoin: () => void;
}

function WhatsAppDetail({
  sub,
  phoneInput,
  setPhoneInput,
  enrollLoading,
  joinInstructions,
  onEnroll,
  onResendJoin,
  onTest,
  testing,
  onCopyJoin,
}: WhatsAppDetailProps) {
  if (!sub?.whatsappEnabled) {
    return (
      <p style={{ fontSize: "12px", color: "var(--m-ink-soft)" }}>
        Toggle on to add a phone and complete the WhatsApp join.
      </p>
    );
  }

  // No phone yet → show entry
  if (!sub.phoneE164) {
    return (
      <div className="flex flex-col gap-2 w-full">
        <label
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "var(--m-ink-soft)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Your WhatsApp number
        </label>
        <div className="flex gap-2 w-full">
          <input
            type="tel"
            inputMode="numeric"
            placeholder="98765 43210"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            className="flex-1 px-3 py-2 outline-none"
            style={{
              fontSize: "13px",
              background: "var(--m-cream-2)",
              border: "1px solid var(--m-ink-faint)",
              borderRadius: "10px",
              color: "var(--m-ink)",
              minWidth: "0",
            }}
          />
          <button
            onClick={onEnroll}
            disabled={enrollLoading || !phoneInput.trim()}
            className="px-3 py-2 transition-colors text-white"
            style={{
              fontSize: "12px",
              fontWeight: 700,
              background: phoneInput.trim() ? "var(--m-forest)" : "var(--m-cream-2)",
              color: phoneInput.trim() ? "var(--m-on-deep)" : "var(--m-ink-soft)",
              borderRadius: "10px",
              cursor: enrollLoading ? "wait" : phoneInput.trim() ? "pointer" : "not-allowed",
            }}
          >
            {enrollLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Continue"}
          </button>
        </div>
        <p style={{ fontSize: "11px", color: "var(--m-ink-soft)" }}>
          India default — for other countries, include the + and country code (e.g. +1...).
        </p>
      </div>
    );
  }

  // Phone saved + pending → show JOIN instructions
  if (sub.whatsappStatus === "pending") {
    return (
      <div className="flex flex-col gap-3 w-full">
        <p style={{ fontSize: "12px", color: "var(--m-ink-soft)", lineHeight: 1.5 }}>
          Open WhatsApp on <strong style={{ color: "var(--m-ink)" }}>{sub.phoneE164}</strong> and send this text to{" "}
          <strong style={{ color: "var(--m-ink)" }}>
            {joinInstructions?.to ?? "+1 415 523 8886"}
          </strong>
          :
        </p>
        {joinInstructions ? (
          <div
            className="flex items-center justify-between gap-2 p-3"
            style={{
              background: "var(--m-cream-2)",
              border: "1px dashed var(--m-ink-faint)",
              borderRadius: "10px",
            }}
          >
            <code
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "13px",
                color: "var(--m-ink)",
              }}
            >
              {joinInstructions.text}
            </code>
            <button
              onClick={onCopyJoin}
              className="inline-flex items-center gap-1 px-2.5 py-1.5"
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--m-ink)",
                background: "var(--m-card)",
                border: "1px solid var(--m-ink-faint)",
                borderRadius: "999px",
              }}
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
        ) : (
          <button
            onClick={onResendJoin}
            className="self-start inline-flex items-center gap-1.5 px-3 py-1.5"
            style={{
              fontSize: "12px",
              fontWeight: 600,
              background: "var(--m-cream-2)",
              color: "var(--m-ink)",
              border: "1px solid var(--m-ink-faint)",
              borderRadius: "980px",
            }}
          >
            Show join code
          </button>
        )}
        <p style={{ fontSize: "11px", color: "var(--m-ink-soft)" }}>
          We&apos;ll auto-detect when you join. This usually takes a few seconds.
        </p>
      </div>
    );
  }

  // Active
  if (sub.whatsappStatus === "active") {
    return (
      <div className="flex flex-col gap-2 w-full">
        <p style={{ fontSize: "12px", color: "var(--m-ink-soft)" }}>
          Connected on <strong style={{ color: "var(--m-ink)" }}>{sub.phoneE164}</strong>
        </p>
        <button
          onClick={onTest}
          disabled={testing}
          className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 transition-colors"
          style={{
            fontSize: "12px",
            fontWeight: 600,
            background: "var(--m-cream-2)",
            color: "var(--m-ink)",
            border: "1px solid var(--m-ink-faint)",
            borderRadius: "980px",
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
      </div>
    );
  }

  // Revoked
  return (
    <p style={{ fontSize: "12px", color: "var(--m-red)" }}>
      Channel revoked (you sent STOP). Toggle off and on, then re-send the JOIN code to re-enable.
    </p>
  );
}

interface SwiggyCardProps {
  status: SwiggyStatus | null;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

function SwiggyCard({ status, busy, onConnect, onDisconnect }: SwiggyCardProps) {
  // Loading
  if (!status) {
    return (
      <div
        className="p-5 animate-pulse"
        style={{
          background: "var(--m-card)",
          border: "1px solid var(--m-ink-faint)",
          borderRadius: "16px",
          minHeight: "120px",
        }}
      />
    );
  }

  const configured = status.configured !== false;
  const connected = status.connected;
  const expiring = status.expiringWithin24h;

  const statusLabel = !configured
    ? "Not configured"
    : connected
      ? expiring
        ? "Expiring soon"
        : "Connected"
      : status.expired
        ? "Expired"
        : "Not connected";

  const tone: "active" | "pending" | "off" = connected && !expiring
    ? "active"
    : connected || expiring
      ? "pending"
      : "off";
  const t = STATUS_TONE[tone];

  return (
    <div
      className="p-5"
      style={{
        background: "var(--m-card)",
        border: "1px solid var(--m-ink-faint)",
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
            background: "var(--m-cream-2)",
            color: "var(--m-ink-soft)",
          }}
        >
          <Utensils className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--m-ink)" }}>
              Swiggy agent
            </h3>
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
              {statusLabel}
            </span>
          </div>
          <p style={{ fontSize: "12px", color: "var(--m-ink-soft)", marginTop: "4px", lineHeight: 1.4 }}>
            Connect your Swiggy account so the chat can order ingredients on Instamart, order food, and book DineOut tables on your behalf.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {!configured && (
          <div
            className="flex items-start gap-2 px-3 py-2.5"
            style={{
              background: "color-mix(in srgb, var(--m-burnt) 10%, transparent)",
              border: "1.5px solid color-mix(in srgb, var(--m-burnt) 26%, transparent)",
              borderRadius: "10px",
              color: "var(--m-ink-soft)",
            }}
          >
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "var(--m-burnt)" }} />
            <p style={{ fontSize: "11px", lineHeight: 1.45 }}>
              Swiggy MCP credentials aren&apos;t wired yet. This will become live once the app is approved at{" "}
              <a
                href="https://mcp.swiggy.com/builders/access/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--m-forest)", textDecoration: "underline" }}
              >
                mcp.swiggy.com/builders/access
              </a>
              .
            </p>
          </div>
        )}

        {expiring && (
          <p style={{ fontSize: "11px", color: "color-mix(in srgb, var(--m-burnt) 50%, var(--m-ink))" }}>
            Token expires in &lt;24h. Re-connect to keep the agent working — Swiggy MCP v1 doesn&apos;t support refresh tokens yet.
          </p>
        )}

        {status.expiresAt && (
          <p style={{ fontSize: "11px", color: "var(--m-ink-soft)" }}>
            Token expires {new Date(status.expiresAt).toLocaleString()}.
          </p>
        )}

        <div className="flex gap-2">
          {connected ? (
            <button
              onClick={onDisconnect}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 transition-colors"
              style={{
                fontSize: "12px",
                fontWeight: 600,
                background: "var(--m-cream-2)",
                color: "var(--m-ink)",
                border: "1px solid var(--m-ink-faint)",
                borderRadius: "980px",
              }}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Disconnect
            </button>
          ) : (
            <button
              onClick={onConnect}
              disabled={busy || !configured}
              className="inline-flex items-center gap-1.5 px-4 py-2 transition-colors text-white"
              style={{
                fontSize: "12px",
                fontWeight: 600,
                background: configured ? "var(--m-forest)" : "var(--m-cream-2)",
                color: configured ? "var(--m-on-deep)" : "var(--m-ink-soft)",
                borderRadius: "980px",
                cursor: configured && !busy ? "pointer" : "not-allowed",
              }}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Connect Swiggy
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

