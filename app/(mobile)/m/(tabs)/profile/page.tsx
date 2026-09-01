"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Settings, ChevronRight, LogOut, Sparkles, Heart, MapPin, Utensils } from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import { createClient } from "@/lib/supabase/client";
import { getFavorites, getMealLogs } from "@/lib/storage";
import { loggingStreak } from "@/lib/nutrition";
import { Tomato, Carrot, Broccoli, Pineapple } from "@/components/mascots";

/**
 * Profile — built to the Flow 7 artboard (1n), which puts the INBOX on this
 * screen rather than behind its own entry point. The full list stays at
 * /m/inbox; the newest three surface here.
 *
 * The artboard's three stat tiles are "meals logged / recipes cooked / orders".
 * Only the first has a data model. "Cooked" is not tracked anywhere and there
 * is no order history table, so those two tiles become saved-recipe count and
 * logging streak — both real, both already computed elsewhere in the app.
 *
 * The artboard also shows an unread dot per inbox row. notification_log has a
 * delivery `status` but no read state, so a dot would be a fabricated unread
 * count. Rows show their real age instead.
 */

interface Row {
  id: string;
  channel: string;
  sent_at: string;
  payload: { title?: string; body?: string } | null;
}

/** Rotating mascots give the feed the artboard's texture without implying meaning. */
const INBOX_MASCOTS = [Carrot, Broccoli, Pineapple];

function rel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function ProfileTab() {
  const router = useRouter();
  const { user, userName, location, signOut, hydrated } = useUser();
  const supabase = createClient();

  const [mealsLogged, setMealsLogged] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [inbox, setInbox] = useState<Row[]>([]);
  const [isPro, setIsPro] = useState<boolean | null>(null);

  useEffect(() => {
    const logs = getMealLogs();
    setMealsLogged(logs.length);
    setStreak(loggingStreak(logs));
    setSavedCount(getFavorites().length);
  }, []);

  useEffect(() => {
    if (!user) { setInbox([]); setIsPro(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("notification_log")
        .select("id, channel, sent_at, payload")
        .eq("user_id", user.id)
        .order("sent_at", { ascending: false })
        .limit(3);
      if (!cancelled) setInbox((data as Row[]) ?? []);
      try {
        const res = await fetch("/api/subscribe/status");
        const json = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) setIsPro(Boolean(json.isPro));
      } catch { /* status is decoration here — a failure just hides the badge */ }
    })();
    return () => { cancelled = true; };
  }, [user, supabase]);

  const name = hydrated && userName ? userName : "Guest";
  const subtitle = [
    streak > 0 ? `Streak ${streak}` : null,
    savedCount > 0 ? `${savedCount} saved` : null,
    isPro === true ? "meshi+" : isPro === false ? "Free plan" : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="vstack" style={{ minHeight: "100dvh", background: "var(--m-cream)", padding: "calc(env(safe-area-inset-top, 12px) + 10px) 20px 0", gap: 14 }}>
      {/* Header */}
      <div className="hstack">
        <span
          style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--m-tint-peach)", display: "grid", placeItems: "center", flex: "none" }}
        >
          <Tomato width={44} height={44} />
        </span>
        <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
          <span className="t-h1" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
          <span className="t-cap">{subtitle || user?.email || "Not signed in"}</span>
        </div>
        <button className="icon-btn" onClick={() => router.push("/m/settings/notifications")} aria-label="Settings">
          <Settings width={20} height={20} />
        </button>
      </div>

      {!user && hydrated && (
        <button className="pill-primary" style={{ width: "100%" }} onClick={() => router.push("/m/onboarding")}>
          Sign in
        </button>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <Stat tint="tint-green" ink="var(--m-forest-2)" value={mealsLogged} label="meals logged" />
        <Stat tint="tint-peach" ink="var(--m-burnt)" value={savedCount} label="saved" />
        <Stat tint="tint-lav" ink="var(--m-plum)" value={streak} label="day streak" />
      </div>

      {/* Destinations. Not in the artboard, but the tab bar has no Saved tab —
          this is its only entry point, and Location / Swiggy have none either.
          Dropping them would orphan three working routes.

          Swiggy now stays inside /m: account linking (artboard 7e) is built as
          /m/settings/connections, so this no longer full-page-loads into the
          web shell the way it did when its only home was the web Connections
          tab. That was the last cross-root-layout jump in the mobile tree. */}
      <div className="hstack hscroll" style={{ gap: 8 }}>
        <button className="chip" onClick={() => router.push("/m/saved")}>
          <Heart width={14} height={14} /> Saved
        </button>
        <button className="chip" onClick={() => router.push("/m/onboarding")}>
          <MapPin width={14} height={14} /> {location ? "Location set" : "Set location"}
        </button>
        <button className="chip" onClick={() => router.push("/m/settings/connections")}>
          <Utensils width={14} height={14} /> Swiggy
        </button>
      </div>

      {/* Inbox */}
      <div className="hstack" style={{ justifyContent: "space-between" }}>
        <span className="t-h1">Inbox</span>
        {inbox.length > 0 && (
          <button
            onClick={() => router.push("/m/inbox")}
            className="t-cap"
            style={{ background: "none", border: "none", padding: 0, color: "var(--m-forest)", fontWeight: 700 }}
          >
            See all ›
          </button>
        )}
      </div>

      <div className="scroll vstack" style={{ flex: 1, gap: 12, paddingBottom: 12 }}>
        {inbox.map((n, i) => {
          const Mascot = INBOX_MASCOTS[i % INBOX_MASCOTS.length];
          return (
            <button key={n.id} className="row" onClick={() => router.push("/m/inbox")} style={{ width: "100%", textAlign: "left", border: "none" }}>
              <Mascot width={34} height={34} style={{ flex: "none" }} />
              <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
                <span className="t-h2" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.payload?.title ?? "meshi"}</span>
                <span className="t-cap" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.payload?.body ?? n.channel}</span>
              </div>
              <span className="t-cap" style={{ flex: "none" }}>{rel(n.sent_at)}</span>
            </button>
          );
        })}

        {user && inbox.length === 0 && (
          <div className="row" style={{ boxShadow: "none", background: "transparent", border: "2px dashed var(--m-ink-faint)", justifyContent: "center" }}>
            <span className="t-cap">No messages yet — turn on daily nudges in Settings.</span>
          </div>
        )}

        {/* Plan */}
        <button className="row" onClick={() => router.push("/m/paywall")} style={{ width: "100%", textAlign: "left", border: "none" }}>
          <span className="icon-btn tint-lav" style={{ boxShadow: "none", color: "var(--m-plum)", flex: "none" }}>
            <Sparkles width={20} height={20} />
          </span>
          <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
            <span className="t-h2">meshi+ · {isPro ? "manage plan" : "go unlimited"}</span>
            <span className="t-cap">{isPro ? "You're on meshi+" : "Unlimited Bo chats, photo logging and more"}</span>
          </div>
          <ChevronRight width={18} height={18} style={{ color: "var(--m-ink-soft)", flex: "none" }} />
        </button>

        {user && (
          <button onClick={() => signOut()} className="pill-secondary" style={{ width: "100%", marginTop: 4 }}>
            <LogOut width={16} height={16} /> Sign out
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ tint, ink, value, label }: { tint: string; ink: string; value: number; label: string }) {
  return (
    <div className={`card ${tint} vstack`} style={{ boxShadow: "none", padding: 12, alignItems: "center", gap: 2, minWidth: 0 }}>
      <span style={{ font: "800 22px/1 var(--m-font-display)", color: ink }}>{value}</span>
      <span className="t-micro">{label}</span>
    </div>
  );
}
