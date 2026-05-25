"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, Search } from "lucide-react";

/**
 * meshi Search / Discover (v2-screens ScreenSearch). Search field that hands
 * the query to chat, a featured hero, and collection tiles that seed the chat.
 * Drill-in (full-screen). Curated content is static; everything routes into
 * the real chat.
 */

const COLLECTIONS = [
  { l: "20-min dinners", cls: "ph-saffron", q: "quick 20-minute dinner ideas" },
  { l: "Date-night spots", cls: "ph-rose", q: "romantic date-night restaurants near me" },
  { l: "Healthy bowls", cls: "ph-spinach", q: "healthy grain bowl recipes" },
  { l: "High protein", cls: "ph-blue", q: "high-protein meals" },
];

export default function MobileSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const go = (query: string) => {
    if (!query.trim()) return;
    router.push(`/m/chat?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="col" style={{ minHeight: "100dvh", background: "var(--cc-bg)" }}>
      <div className="row" style={{ padding: "calc(env(safe-area-inset-top,12px) + 6px) 14px 6px", gap: 8 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--cc-ink-1)" }} aria-label="Back"><ChevronLeft width={22} height={22} /></button>
        <h1 className="t-h1">Discover</h1>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); go(q); }}
        className="row"
        style={{ margin: "8px 16px 6px", background: "var(--cc-surf-2)", borderRadius: "var(--cc-r-pill)", padding: "8px 14px", gap: 8, border: "1px solid var(--cc-line)" }}
      >
        <Search width={16} height={16} style={{ color: "var(--cc-ink-3)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recipes, restaurants…" style={{ flex: 1, background: "none", border: "none", padding: 0, fontSize: 14 }} />
      </form>

      <div className="scroll" style={{ flex: 1, padding: "12px 16px 90px" }}>
        {/* Featured */}
        <button onClick={() => go("late-night food open now near me")} className="ph ph-night" style={{ display: "block", width: "100%", height: 180, borderRadius: "var(--cc-r-lg)", position: "relative", overflow: "hidden", marginTop: 4, border: "none", textAlign: "left" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.8))" }} />
          <div style={{ position: "absolute", left: 16, right: 16, bottom: 14, color: "#fff" }}>
            <span className="chip" style={{ background: "rgba(255,255,255,0.18)", borderColor: "transparent", color: "#fff", fontSize: 10 }}>FEATURED</span>
            <h2 className="t-h1" style={{ marginTop: 8, fontSize: 22 }}>The midnight noodle index</h2>
            <p className="t-small" style={{ color: "rgba(255,255,255,0.85)" }}>Late-night spots open right now</p>
          </div>
        </button>

        <div style={{ marginTop: 22 }}>
          <h3 className="t-h2" style={{ marginBottom: 12 }}>Collections</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {COLLECTIONS.map((c) => (
              <button key={c.l} onClick={() => go(c.q)} className={`ph ${c.cls}`} style={{ height: 110, borderRadius: "var(--cc-r-md)", position: "relative", overflow: "hidden", border: "none", textAlign: "left" }}>
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.7))" }} />
                <div style={{ position: "absolute", left: 12, right: 12, bottom: 10, color: "#fff", fontSize: 13, fontWeight: 600 }}>{c.l}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
