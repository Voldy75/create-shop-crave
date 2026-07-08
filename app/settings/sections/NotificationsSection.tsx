"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bell, MessageCircle, Info, Send, Loader2, Copy, Utensils, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/app/context/UserContext";
import { getMySubscription, upsertMySubscription } from "@/lib/notifications-client";
import { enableWebPush, disableWebPush, isPushSupported, pushPermission, sendTestPush } from "@/lib/push-client";
import { enrollWhatsApp, disableWhatsApp, sendWhatsAppTest, type JoinInstructions } from "@/lib/whatsapp-client";
import { getSwiggyStatus, startSwiggyAuth, disconnectSwiggy, type SwiggyStatus } from "@/lib/swiggy-client";
import type { NotificationSubscription } from "@/lib/types";
import { StatusPill, type StatusTone } from "@/components/cc/status-pill";
import { IconBadge } from "@/components/cc/icon-badge";

export function NotificationsSection() {
  const { user, hydrated } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sub, setSub] = useState<NotificationSubscription | null>(null);
  const [testing, setTesting] = useState(false);
  const [pushSupport, setPushSupport] = useState({ supported: false, permission: "unsupported" });
  const [phoneInput, setPhoneInput] = useState("");
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [joinInstructions, setJoinInstructions] = useState<JoinInstructions | null>(null);
  const [wTesting, setWTesting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [swiggy, setSwiggy] = useState<SwiggyStatus | null>(null);
  const [swiggyBusy, setSwiggyBusy] = useState(false);

  useEffect(() => {
    setPushSupport({ supported: isPushSupported(), permission: pushPermission() });
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") {
      toast("Swiggy connected");
      window.history.replaceState({}, "", "/settings?tab=notifications");
    } else if (params.get("error")) {
      toast(`Swiggy connect failed: ${params.get("error")}`);
      window.history.replaceState({}, "", "/settings?tab=notifications");
    }
    void refreshSwiggy();
  }, []);

  const refreshSwiggy = async () => {
    const status = await getSwiggyStatus();
    setSwiggy(status);
  };

  useEffect(() => {
    if (sub?.whatsappStatus !== "pending") {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = setInterval(async () => {
      const next = await getMySubscription();
      if (next && next.whatsappStatus !== "pending") {
        setSub(next);
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (next.whatsappStatus === "active") toast("WhatsApp connected");
      }
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [sub?.whatsappStatus]);

  useEffect(() => {
    if (!hydrated || !user) { setLoading(false); return; }
    let cancelled = false;
    getMySubscription().then((s) => { if (!cancelled) { setSub(s); setLoading(false); } });
    return () => { cancelled = true; };
  }, [user, hydrated]);

  const toggle = async (channel: "webPush" | "whatsapp") => {
    if (!sub && !user) return;
    setSaving(true);
    try {
      if (channel === "webPush") {
        const willEnable = !(sub?.webPushEnabled ?? false);
        if (willEnable) {
          if (!pushSupport.supported) { toast("This browser doesn't support push."); return; }
          const result = await enableWebPush();
          if (!result.ok) { toast(result.reason === "permission_denied" ? "Permission blocked. Allow in site settings." : "Couldn't enable push."); return; }
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
          if (sub?.phoneE164) {
            const next = await upsertMySubscription({ whatsappEnabled: true });
            if (next) setSub(next);
            toast(sub.whatsappStatus === "active" ? "WhatsApp turned on" : "WhatsApp turned on — complete the JOIN step below");
          } else {
            const next = await upsertMySubscription({ whatsappEnabled: true });
            if (next) setSub(next);
          }
        } else {
          await disableWhatsApp();
          setSub(await getMySubscription());
          toast("WhatsApp turned off");
        }
      }
    } finally { setSaving(false); }
  };

  const handleSendTest = async () => {
    setTesting(true);
    try {
      const result = await sendTestPush();
      toast(result.ok ? "Test push sent." : `Test failed: ${result.reason}`);
    } finally { setTesting(false); }
  };

  const handleEnroll = async () => {
    setEnrollLoading(true);
    try {
      const result = await enrollWhatsApp(phoneInput);
      if (!result.ok) { toast(result.reason || "Couldn't enroll"); return; }
      setJoinInstructions(result.joinInstructions || null);
      setSub(await getMySubscription());
      toast("Phone saved — complete the JOIN step on WhatsApp");
    } finally { setEnrollLoading(false); }
  };

  const handleResendJoin = async () => {
    if (sub?.phoneE164 && !joinInstructions) {
      const result = await enrollWhatsApp(sub.phoneE164);
      if (result.ok) setJoinInstructions(result.joinInstructions || null);
    }
  };

  const handleWhatsAppTest = async () => {
    setWTesting(true);
    try {
      const result = await sendWhatsAppTest();
      if (result.ok) toast("Test WhatsApp sent.");
      else if (result.channelClosed) { toast("Session closed — re-send the JOIN code."); setSub(await getMySubscription()); }
      else toast(`Test failed: ${result.reason}`);
    } finally { setWTesting(false); }
  };

  const handleSwiggyConnect = async () => {
    setSwiggyBusy(true);
    const result = await startSwiggyAuth();
    if (!result.ok) { toast(`Couldn't start Swiggy auth: ${result.reason}`); setSwiggyBusy(false); }
  };

  const handleSwiggyDisconnect = async () => {
    setSwiggyBusy(true);
    try { await disconnectSwiggy(); await refreshSwiggy(); toast("Swiggy disconnected"); }
    finally { setSwiggyBusy(false); }
  };

  if (!user && hydrated) {
    return <p style={{ fontSize: "13px", color: "var(--cc-text-secondary)" }}>Sign in to manage notifications.</p>;
  }

  if (loading) {
    return <div className="animate-pulse h-40 rounded-2xl" style={{ background: "var(--cc-surface)" }} />;
  }

  return (
    <div className="space-y-4">
      <div className="p-4" style={{ background: "var(--cc-surface)", border: "1px solid var(--cc-border)", borderRadius: "16px" }}>
        <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--cc-text-primary)" }}>Daily nudges</h2>
        <p style={{ fontSize: "12px", color: "var(--cc-text-secondary)", marginTop: "4px", lineHeight: 1.5 }}>
          Get a personalised diet suggestion at 8pm IST based on what you logged today.
        </p>
      </div>

      <ChannelCard
        icon={Bell} title="Web push"
        subtitle="Browser notifications"
        enabled={sub?.webPushEnabled ?? false}
        status={sub?.webPushEnabled ? "Active" : "Off"}
        tone={sub?.webPushEnabled ? "active" : "off"}
        saving={saving}
        onToggle={() => toggle("webPush")}
        detail={
          <>
            {!pushSupport.supported && <Note color="#ff9f0a">This browser doesn&apos;t support web push.</Note>}
            {pushSupport.supported && pushSupport.permission === "denied" && <Note color="#ff453a">Permission blocked. Allow in site settings.</Note>}
            {sub?.webPushEnabled && (
              <SmallButton onClick={handleSendTest} loading={testing} icon={Send}>Send test</SmallButton>
            )}
          </>
        }
      />

      <ChannelCard
        icon={MessageCircle} title="WhatsApp"
        subtitle="Daily nudge via Twilio Sandbox"
        enabled={sub?.whatsappEnabled ?? false}
        status={sub?.whatsappStatus === "active" ? "Connected" : sub?.whatsappStatus === "pending" ? "Pending join" : sub?.whatsappEnabled ? "Awaiting phone" : "Off"}
        tone={sub?.whatsappStatus === "active" ? "active" : sub?.whatsappEnabled ? "pending" : "off"}
        saving={saving}
        onToggle={() => toggle("whatsapp")}
        detail={
          <WhatsAppDetail
            sub={sub} phoneInput={phoneInput} setPhoneInput={setPhoneInput}
            enrollLoading={enrollLoading} joinInstructions={joinInstructions}
            onEnroll={handleEnroll} onResendJoin={handleResendJoin}
            onTest={handleWhatsAppTest} testing={wTesting}
            onCopyJoin={async () => {
              if (!joinInstructions) return;
              try { await navigator.clipboard.writeText(joinInstructions.text); toast("Copied"); } catch { toast("Copy failed"); }
            }}
          />
        }
      />

      <SwiggyCard status={swiggy} busy={swiggyBusy} onConnect={handleSwiggyConnect} onDisconnect={handleSwiggyDisconnect} />
    </div>
  );
}

// ── Subcomponents ──

function Note({ color, children }: { color: string; children: React.ReactNode }) {
  return <p style={{ fontSize: "11px", color }}>{children}</p>;
}

function SmallButton({ onClick, loading, icon: Icon, children }: { onClick: () => void; loading: boolean; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-1 transition-colors"
      style={{ fontSize: "12px", fontWeight: 600, background: "var(--cc-surface-2)", color: "var(--cc-text-primary)", border: "1px solid var(--cc-border)", borderRadius: "980px" }}>
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {children}
    </button>
  );
}

function ChannelCard({ icon, title, subtitle, enabled, status, tone, saving, onToggle, detail }: {
  icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string; enabled: boolean;
  status: string; tone: StatusTone; saving: boolean; onToggle: () => void; detail: React.ReactNode;
}) {
  return (
    <div className="p-4" style={{ background: "var(--cc-surface)", border: "1px solid var(--cc-border)", borderRadius: "16px" }}>
      <div className="flex items-start gap-3">
        <IconBadge icon={icon} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--cc-text-primary)" }}>{title}</h3>
            <StatusPill tone={tone}>{status}</StatusPill>
          </div>
          <p style={{ fontSize: "11px", color: "var(--cc-text-secondary)", marginTop: "2px" }}>{subtitle}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex-1">{detail}</div>
        <button onClick={onToggle} disabled={saving} aria-label={`Toggle ${title}`}
          className="ml-3 shrink-0 relative w-10 h-6 rounded-full transition-colors"
          style={{ background: enabled ? "#34c759" : "var(--cc-surface-2)" }}>
          <span className="absolute top-0.5 rounded-full w-5 h-5 bg-white shadow-sm transition-transform"
            style={{ left: enabled ? "18px" : "2px" }} />
        </button>
      </div>
    </div>
  );
}

function SwiggyCard({ status, busy, onConnect, onDisconnect }: { status: SwiggyStatus | null; busy: boolean; onConnect: () => void; onDisconnect: () => void }) {
  if (!status) return <div className="animate-pulse h-24 rounded-2xl" style={{ background: "var(--cc-surface)" }} />;
  const connected = status.connected;
  return (
    <div className="p-4" style={{ background: "var(--cc-surface)", border: "1px solid var(--cc-border)", borderRadius: "16px" }}>
      <div className="flex items-start gap-3">
        <IconBadge icon={Utensils} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--cc-text-primary)" }}>Swiggy agent</h3>
            <StatusPill tone={connected ? "active" : "off"}>
              {connected ? "Connected" : "Not connected"}
            </StatusPill>
          </div>
          <p style={{ fontSize: "11px", color: "var(--cc-text-secondary)", marginTop: "2px" }}>
            Order food, groceries, and book tables via chat.
          </p>
        </div>
      </div>
      <div className="mt-3">
        {connected ? (
          <SmallButton onClick={onDisconnect} loading={busy} icon={AlertCircle}>Disconnect</SmallButton>
        ) : (
          <button onClick={onConnect} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 transition-colors"
            style={{ fontSize: "12px", fontWeight: 600, background: "var(--cc-accent)", color: "#fff", borderRadius: "980px" }}>
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Connect Swiggy
          </button>
        )}
      </div>
    </div>
  );
}

function WhatsAppDetail({ sub, phoneInput, setPhoneInput, enrollLoading, joinInstructions, onEnroll, onResendJoin, onTest, testing, onCopyJoin }: {
  sub: NotificationSubscription | null; phoneInput: string; setPhoneInput: (v: string) => void;
  enrollLoading: boolean; joinInstructions: JoinInstructions | null; onEnroll: () => void;
  onResendJoin: () => void; onTest: () => void; testing: boolean; onCopyJoin: () => void;
}) {
  if (!sub?.whatsappEnabled) return null;
  if (!sub.phoneE164) {
    return (
      <div className="flex gap-2 mt-1">
        <input value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} placeholder="+91 98765 43210"
          className="px-3 py-1.5 flex-1 min-w-0" style={{ fontSize: "12px", background: "var(--cc-surface-2)", border: "1px solid var(--cc-border)", borderRadius: "8px", color: "var(--cc-text-primary)" }} />
        <button onClick={onEnroll} disabled={enrollLoading || !phoneInput.trim()} className="px-3 py-1.5 shrink-0"
          style={{ fontSize: "12px", fontWeight: 600, background: "var(--cc-accent)", color: "#fff", borderRadius: "8px" }}>
          {enrollLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
        </button>
      </div>
    );
  }
  if (sub.whatsappStatus === "pending") {
    return (
      <div className="flex flex-col gap-1.5 mt-1">
        <p style={{ fontSize: "11px", color: "var(--cc-text-secondary)" }}>Send this JOIN code on WhatsApp:</p>
        {joinInstructions ? (
          <div className="flex items-center gap-2">
            <code className="px-2 py-1 font-mono" style={{ fontSize: "12px", background: "var(--cc-surface-2)", borderRadius: "6px", color: "var(--cc-text-primary)" }}>{joinInstructions.text}</code>
            <button onClick={onCopyJoin} className="px-2 py-1" style={{ fontSize: "11px", background: "var(--cc-surface-2)", border: "1px solid var(--cc-border)", borderRadius: "999px", color: "var(--cc-text-primary)" }}>
              <Copy className="w-3 h-3 inline" /> Copy
            </button>
          </div>
        ) : (
          <SmallButton onClick={onResendJoin} loading={false} icon={Info}>Show join code</SmallButton>
        )}
      </div>
    );
  }
  if (sub.whatsappStatus === "active") {
    return (
      <div className="mt-1">
        <p style={{ fontSize: "11px", color: "var(--cc-text-secondary)" }}>Connected on <strong>{sub.phoneE164}</strong></p>
        <SmallButton onClick={onTest} loading={testing} icon={Send}>Send test</SmallButton>
      </div>
    );
  }
  return <Note color="#ff453a">Channel revoked. Toggle off and on, then re-send JOIN.</Note>;
}
