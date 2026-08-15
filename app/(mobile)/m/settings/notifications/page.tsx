"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bell, MessageCircle, Loader2, Send } from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import { getMySubscription, upsertMySubscription } from "@/lib/notifications-client";
import { enableWebPush, disableWebPush, isPushSupported, pushPermission, sendTestPush } from "@/lib/push-client";
import { enrollWhatsApp, disableWhatsApp, sendWhatsAppTest, type JoinInstructions } from "@/lib/whatsapp-client";
import { Switch } from "@/components/mobile/Switch";
import { BoBowl } from "@/components/mascots";
import type { NotificationSubscription } from "@/lib/types";

/**
 * Notifications — artboard 7c, in the MOBILE tree.
 *
 * This existed only as `app/(web)/(app)/settings/notifications`, and
 * `/m/profile` pushed at it: a cross-root-layout jump that full-page-loads
 * into the web shell, sidebar and all. Same backend, same clients — the
 * difference is that this one is built to the artboard and stays inside /m.
 *
 * The web route is NOT deleted. It is still the desktop surface and still
 * carries the Swiggy connection block, which has no mobile artboard.
 *
 * "In-app" here means web push / native push, which is what the artboard's
 * "Push notifications" row means and what `notification_log` records. The
 * inbox at /m/inbox is the read side of the same pipe.
 */

const WHATSAPP_GREEN = "#25D366"; // hex-ok: WhatsApp's own brand green, partner identity
const ON_BRAND = "#FFFFFF"; // hex-ok: paired with the brand green above, not meshi's cream

/** "+919876543210" → "+91 98••• ••210", matching the artboard's masking. */
function maskPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const digits = e164.replace(/[^\d]/g, "");
  if (digits.length < 7) return e164;
  const cc = e164.startsWith("+") ? `+${digits.slice(0, digits.length - 10)}` : "";
  const local = digits.slice(-10);
  return `${cc} ${local.slice(0, 2)}••• ••${local.slice(-3)}`.trim();
}

export default function MobileNotifications() {
  const router = useRouter();
  const { user, hydrated } = useUser();

  const [sub, setSub] = useState<NotificationSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"push" | "whatsapp" | "test" | "wtest" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pushSupport, setPushSupport] = useState({ supported: false, permission: "unsupported" as string });
  const [phoneInput, setPhoneInput] = useState("");
  const [join, setJoin] = useState<JoinInstructions | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      if (!cancelled) {
        setSub(s);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [user, hydrated]);

  // While WhatsApp is 'pending' the user has been shown a JOIN code and the
  // webhook flips them to 'active'. Poll so the row updates without a manual
  // refresh — same 5s cadence the web settings page uses.
  useEffect(() => {
    if (sub?.whatsappStatus !== "pending") {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = setInterval(async () => {
      const next = await getMySubscription();
      if (next && next.whatsappStatus !== "pending") {
        setSub(next);
        if (next.whatsappStatus === "active") setNote("WhatsApp connected ✓");
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [sub?.whatsappStatus]);

  const togglePush = async () => {
    setBusy("push");
    setNote(null);
    try {
      if (sub?.webPushEnabled) {
        await disableWebPush();
        setSub(await getMySubscription());
        setNote("Push turned off.");
        return;
      }
      if (!pushSupport.supported) {
        setNote("This browser can't do push. On iOS, add meshi to your Home Screen first.");
        return;
      }
      const result = await enableWebPush();
      if (!result.ok) {
        setNote(
          result.reason === "permission_denied"
            ? "Notifications are blocked in your browser settings."
            : result.reason === "permission_dismissed"
              ? "Bo needs permission to send nudges."
              : result.reason === "missing_vapid"
                ? "Push isn't configured on the server yet."
                : "Couldn't turn push on — try again.",
        );
        return;
      }
      setSub(await getMySubscription());
      setNote("Push is on.");
    } finally {
      setPushSupport({ supported: isPushSupported(), permission: pushPermission() });
      setBusy(null);
    }
  };

  const toggleWhatsApp = async () => {
    setBusy("whatsapp");
    setNote(null);
    try {
      if (sub?.whatsappEnabled) {
        await disableWhatsApp();
        setSub(await getMySubscription());
        setNote("WhatsApp turned off.");
        return;
      }
      // Flipping the flag on is all that's needed when a phone already
      // exists; otherwise the JOIN form below renders itself.
      const next = await upsertMySubscription({ whatsappEnabled: true });
      if (next) setSub(next);
    } finally {
      setBusy(null);
    }
  };

  const enroll = async () => {
    setBusy("whatsapp");
    setNote(null);
    try {
      const result = await enrollWhatsApp(phoneInput);
      if (!result.ok) {
        setNote(result.reason || "That number didn't look right.");
        return;
      }
      setJoin(result.joinInstructions ?? null);
      setSub(await getMySubscription());
    } finally {
      setBusy(null);
    }
  };

  const testPush = async () => {
    setBusy("test");
    try {
      const r = await sendTestPush();
      setNote(r.ok ? "Test sent — check your notifications." : `Test failed: ${r.reason}`);
    } finally {
      setBusy(null);
    }
  };

  const testWhatsApp = async () => {
    setBusy("wtest");
    try {
      const r = await sendWhatsAppTest();
      setNote(
        r.ok
          ? "Test sent — check WhatsApp."
          : r.channelClosed
            ? "WhatsApp's 24h window has closed. Message the sandbox number again to reopen it."
            : `Test failed: ${r.reason}`,
      );
    } finally {
      setBusy(null);
    }
  };

  const shell: React.CSSProperties = {
    minHeight: "100dvh",
    background: "var(--m-cream)",
    padding: "calc(env(safe-area-inset-top, 12px) + 10px) 20px calc(env(safe-area-inset-bottom, 0px) + 24px)",
    gap: 12,
  };

  if (!hydrated || loading) {
    return (
      <div className="vstack" style={{ ...shell, alignItems: "center", justifyContent: "center" }}>
        <Loader2 width={20} height={20} className="animate-spin" style={{ color: "var(--m-ink-soft)" }} />
      </div>
    );
  }

  const pushOn = sub?.webPushEnabled ?? false;
  const waOn = sub?.whatsappEnabled ?? false;
  const waActive = sub?.whatsappStatus === "active";
  const needsPhone = waOn && !sub?.phoneE164;

  return (
    <div className="vstack" style={shell}>
      <div className="hstack">
        <button className="icon-btn" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft width={20} height={20} />
        </button>
        <span className="t-h1 grow" style={{ marginLeft: 10 }}>Notifications</span>
      </div>

      <div className="vstack" style={{ gap: 4 }}>
        <span className="t-d2">How should Bo<br />reach you?</span>
        <span className="t-body-soft">Pick one or both. Bo keeps it to one nudge a day.</span>
      </div>

      {!user && (
        <div className="toast tint-peach" style={{ boxShadow: "none" }}>
          <BoBowl width={30} height={30} style={{ flex: "none" }} />
          Sign in first — Bo needs somewhere to send them.
        </div>
      )}

      {/* Push */}
      <button
        className="row"
        style={{ width: "100%", border: "none", textAlign: "left", opacity: user ? 1 : 0.5 }}
        onClick={togglePush}
        disabled={!user || busy === "push"}
        aria-pressed={pushOn}
      >
        <span className="icon-btn tint-peach" style={{ boxShadow: "none", color: "var(--m-burnt)", flex: "none" }}>
          <Bell width={20} height={20} />
        </span>
        <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
          <span className="t-h2">Push notifications</span>
          <span className="t-cap">Streak nudges, order updates, dinner ideas</span>
        </div>
        {busy === "push" ? <Loader2 width={18} height={18} className="animate-spin" /> : <Switch on={pushOn} />}
      </button>

      {pushOn && (
        <button className="pill-secondary pill-sm" style={{ alignSelf: "flex-start" }} onClick={testPush} disabled={busy === "test"}>
          <Send width={13} height={13} />
          {busy === "test" ? "Sending…" : "Send me a test"}
        </button>
      )}

      {/* WhatsApp */}
      <button
        className="row"
        style={{ width: "100%", border: "none", textAlign: "left", opacity: user ? 1 : 0.5 }}
        onClick={toggleWhatsApp}
        disabled={!user || busy === "whatsapp"}
        aria-pressed={waOn}
      >
        <span className="icon-btn tint-green" style={{ boxShadow: "none", color: "var(--m-forest)", flex: "none" }}>
          <MessageCircle width={20} height={20} />
        </span>
        <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
          <span className="t-h2 hstack" style={{ gap: 6 }}>
            WhatsApp
            {waActive && (
              <span className="chip chip-tag" style={{ height: 20, background: WHATSAPP_GREEN, color: ON_BRAND }}>
                on
              </span>
            )}
          </span>
          <span className="t-cap">
            {sub?.phoneE164
              ? `Bo texts your plan & streak · ${maskPhone(sub.phoneE164)}`
              : "Bo texts your plan & streak"}
          </span>
        </div>
        {busy === "whatsapp" ? <Loader2 width={18} height={18} className="animate-spin" /> : <Switch on={waOn} />}
      </button>

      {/* Enrolment only appears once WhatsApp is on and no number is saved. */}
      {needsPhone && (
        <div className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="t-cap">Your WhatsApp number, with country code.</span>
          <input
            className="input"
            style={{ width: "100%", height: 48 }}
            type="tel"
            inputMode="tel"
            placeholder="+91 98765 43210"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
          />
          <button className="pill-primary pill-sm" onClick={enroll} disabled={!phoneInput.trim() || busy === "whatsapp"}>
            Save number
          </button>
        </div>
      )}

      {join && (
        <div className="card tint-green" style={{ boxShadow: "none", padding: 14 }}>
          <span className="t-body" style={{ color: "var(--m-forest-2)" }}>
            One more step — send <b>{join.text}</b> to <b>{join.to}</b> on WhatsApp. Bo goes live the moment it lands.
          </span>
        </div>
      )}

      {waActive && (
        <button className="pill-secondary pill-sm" style={{ alignSelf: "flex-start" }} onClick={testWhatsApp} disabled={busy === "wtest"}>
          <Send width={13} height={13} />
          {busy === "wtest" ? "Sending…" : "Send me a test"}
        </button>
      )}

      {note && <span className="t-cap" style={{ color: "var(--m-ink)" }}>{note}</span>}

      <span className="t-micro" style={{ marginTop: 6 }}>What a nudge looks like</span>

      {/* Preview. Static by design — it illustrates the format, and wiring it
          to a real pending nudge would mean inventing one when none is due. */}
      <div className="card" style={{ padding: "12px 14px", display: "flex", gap: 12, alignItems: "center" }}>
        <BoBowl width={40} height={40} style={{ flex: "none" }} />
        <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
          <span className="t-h2" style={{ fontSize: 14 }}>meshi · now</span>
          <span className="t-cap">Dinner o&rsquo;clock 🍜 log a meal to keep your flame.</span>
        </div>
      </div>

      <div className="hstack" style={{ alignItems: "flex-end", gap: 10 }}>
        <span
          style={{
            width: 36, height: 36, borderRadius: "50%", background: WHATSAPP_GREEN,
            display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
          }}
        >
          <MessageCircle width={20} height={20} style={{ color: ON_BRAND }} />
        </span>
        <div className="card tint-green" style={{ boxShadow: "none", padding: "11px 15px", borderBottomLeftRadius: 6 }}>
          <span className="t-body" style={{ color: "var(--m-forest-2)" }}>
            620 kcal left today. Want 3 dinner ideas?
          </span>
        </div>
      </div>

      <div className="grow" />

      {/* Both toggles persist on tap, so there is nothing left to submit —
          the artboard's "Save preferences" would be a button that does
          nothing. This returns instead. */}
      <button className="pill-primary" style={{ width: "100%" }} onClick={() => router.back()}>
        Done
      </button>
    </div>
  );
}
