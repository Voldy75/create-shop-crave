"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, Bell, ShoppingCart, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * meshi Inbox (v2-screens ScreenInbox) — wired to the real notification_log
 * table (the daily-nudge + delivery records). RLS lets the user read their own
 * rows. Each row's payload holds {title, body}. Drill-in from the Home bell;
 * full-screen (no tab bar).
 *
 * The design's "live order tracker" card has no data model yet — omitted until
 * order tracking exists; the notification feed is the real content.
 */

interface Row {
  id: string;
  channel: string;
  sent_at: string;
  status: string;
  payload: { title?: string; body?: string } | null;
}

function rel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const FILTERS = ["All", "Nudges", "Push", "WhatsApp"];

export default function MobileInbox() {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [signedIn, setSignedIn] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) { setSignedIn(false); setLoading(false); } return; }
      const { data } = await supabase
        .from("notification_log")
        .select("id, channel, sent_at, status, payload")
        .eq("user_id", user.id)
        .order("sent_at", { ascending: false })
        .limit(50);
      if (!cancelled) { setRows((data as Row[]) ?? []); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  const filtered = rows.filter((r) =>
    filter === "All" ? true :
    filter === "Push" ? r.channel === "web_push" || r.channel === "native_push" :
    filter === "WhatsApp" ? r.channel === "whatsapp" :
    true,
  );

  return (
    <div className="col" style={{ minHeight: "100dvh", background: "var(--cc-bg)" }}>
      <div className="row" style={{ padding: "calc(env(safe-area-inset-top,12px) + 6px) 14px 8px", gap: 8 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--cc-ink-1)" }} aria-label="Back"><ChevronLeft width={22} height={22} /></button>
        <h1 className="t-h1">Inbox</h1>
      </div>
      <div className="hscroll row" style={{ gap: 6, padding: "4px 14px 10px" }}>
        {FILTERS.map((c) => (
          <button key={c} onClick={() => setFilter(c)} className={`chip ${filter === c ? "chip-solid" : ""}`}>{c}</button>
        ))}
      </div>

      <div className="scroll" style={{ flex: 1, padding: "4px 14px 40px" }}>
        {loading && <p className="t-small" style={{ padding: "12px 4px" }}>Loading…</p>}

        {!loading && !signedIn && (
          <EmptyState icon={<Bell width={26} height={26} />} title="Sign in to see your inbox" sub="Daily nudges and order updates land here." action={<button className="pill-primary" style={{ width: "auto", padding: "10px 22px" }} onClick={() => router.push("/m/profile")}>Sign in</button>} />
        )}

        {!loading && signedIn && filtered.length === 0 && (
          <EmptyState icon={<Bell width={26} height={26} />} title="No messages yet" sub="Enable daily nudges in Settings → Notifications to start getting personalised tips." />
        )}

        {filtered.map((n) => (
          <div key={n.id} className="row" style={{ padding: "14px 8px", gap: 12, borderBottom: "1px solid var(--cc-line)" }}>
            <div className="ph ph-saffron" style={{ width: 40, height: 40, borderRadius: "var(--cc-r-md)", flexShrink: 0, display: "grid", placeItems: "center" }}>
              {n.channel === "whatsapp" ? <ShoppingCart width={16} height={16} style={{ color: "#fff" }} /> : <Sparkles width={16} height={16} style={{ color: "#fff" }} />}
            </div>
            <div className="col" style={{ flex: 1, gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{n.payload?.title ?? "meshi"}</span>
              <span className="t-small">{n.payload?.body ?? n.status}</span>
            </div>
            <span className="t-small" style={{ alignSelf: "flex-start" }}>{rel(n.sent_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, sub, action }: { icon: React.ReactNode; title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className="col" style={{ alignItems: "center", textAlign: "center", gap: 12, paddingTop: "20vh" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--cc-surf-2)", display: "grid", placeItems: "center", color: "var(--cc-ink-3)" }}>{icon}</div>
      <h2 className="t-h2">{title}</h2>
      <p className="t-small" style={{ maxWidth: 260 }}>{sub}</p>
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}
