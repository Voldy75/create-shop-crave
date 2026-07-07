"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import { ArrowLeft, Users, Zap, Crown, TrendingUp, BarChart2, RefreshCw, Lock, Flag, Plus, Loader2 } from "lucide-react";
import { invalidateFlagCache, type FeatureFlag } from "@/lib/feature-flags";

interface DayData { usage_date: string; total: number }
interface TopUser { user_id: string; email: string; total_requests: number; is_pro: boolean }

interface Stats {
  dau: number;
  totalUsers: number;
  proCount: number;
  requestsToday: number;
  requestsWeek: number;
  dailyRequests: DayData[];
  topUsers: TopUser[];
}

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

function Sparkline({ data }: { data: DayData[] }) {
  if (data.length === 0) return (
    <div className="h-12 rounded-lg" style={{ background: "var(--cc-surface-2)" }} />
  );
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="flex items-end gap-1 h-12">
      {data.map((d) => (
        <div
          key={d.usage_date}
          className="flex-1 rounded-sm transition-opacity hover:opacity-100"
          style={{
            height: `${Math.max(4, (d.total / max) * 100)}%`,
            background: "#ff6b35",
            opacity: 0.7,
          }}
          title={`${d.usage_date}: ${d.total} requests`}
        />
      ))}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  iconColor,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  label: string;
  value: number | string;
  sub?: string;
  iconColor: string;
}) {
  return (
    <div className="p-5" style={{ background: "var(--cc-surface)", borderRadius: "12px" }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--cc-text-tertiary)", letterSpacing: "0.08em" }}>{label}</p>
          <p className="text-3xl font-bold mt-1" style={{ color: "var(--cc-text-primary)", letterSpacing: "-0.03em" }}>{value}</p>
          {sub && <p className="text-xs mt-0.5" style={{ color: "var(--cc-text-secondary)" }}>{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${iconColor}18`, color: iconColor }}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, hydrated } = useUser();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (hydrated && !user) router.replace("/");
  }, [hydrated, user, router]);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats");
      if (res.status === 403) { setError("forbidden"); setLoading(false); return; }
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();
      setStats(data);
      setLastRefresh(new Date());
    } catch {
      setError("Failed to load stats. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hydrated && user && isAdmin) fetchStats();
    else if (hydrated && user && !isAdmin) setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, user, isAdmin]);

  if (!hydrated || (loading && !stats && isAdmin)) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "var(--cc-bg)" }}>
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "#ff6b35", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!isAdmin || error === "forbidden") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8" style={{ background: "var(--cc-bg)" }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.2)" }}>
          <Lock className="w-8 h-8" style={{ color: "#ff453a" }} />
        </div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--cc-text-primary)", letterSpacing: "-0.02em" }}>
          Admin Access Only
        </h1>
        <p style={{ color: "var(--cc-text-secondary)" }}>This page is restricted to the app owner.</p>
        <button onClick={() => router.push("/chat")} className="btn-pill-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Chat
        </button>
      </div>
    );
  }

  const conversionRate = stats && stats.totalUsers > 0
    ? ((stats.proCount / stats.totalUsers) * 100).toFixed(1)
    : "0";

  const mrr = stats ? stats.proCount * 9 : 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--cc-bg)" }}>
      <header className="glass-nav px-6 flex items-center justify-between sticky top-0 z-10" style={{ height: "48px" }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/chat")}
            className="p-2 rounded-full transition-colors"
            style={{ color: "var(--cc-text-secondary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--cc-surface-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            aria-label="Back to chat"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-bold text-lg" style={{ color: "var(--cc-text-primary)", letterSpacing: "-0.02em" }}>
              Admin Dashboard
            </h1>
            <p className="text-xs" style={{ color: "var(--cc-text-tertiary)" }}>
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="btn-pill-secondary flex items-center gap-1.5 text-xs h-8 px-4 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-8">
        {error && error !== "forbidden" && (
          <div className="rounded-xl p-4 text-sm"
            style={{ background: "rgba(255,69,58,0.08)", color: "#ff453a", border: "1px solid rgba(255,69,58,0.15)" }}>
            {error}
          </div>
        )}

        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Users" value={stats?.totalUsers ?? 0} iconColor="#0a84ff" />
          <StatCard icon={Zap} label="DAU" value={stats?.dau ?? 0} sub="active today" iconColor="#ff6b35" />
          <StatCard icon={Crown} label="Pro Subscribers" value={stats?.proCount ?? 0} sub={`${conversionRate}% conversion`} iconColor="#ffd60a" />
          <StatCard icon={TrendingUp} label="Est. MRR" value={`$${mrr}`} sub={`₹${mrr * 84} / month`} iconColor="#34c759" />
        </div>

        {/* Request stats + sparkline */}
        <div className="p-6 rounded-2xl" style={{ background: "var(--cc-surface)", border: "1px solid var(--cc-border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4" style={{ color: "#ff6b35" }} />
              <h2 className="font-bold" style={{ color: "var(--cc-text-primary)" }}>AI Requests</h2>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <p className="font-bold" style={{ color: "var(--cc-text-primary)" }}>{stats?.requestsToday ?? 0}</p>
                <p className="text-xs" style={{ color: "var(--cc-text-tertiary)" }}>Today</p>
              </div>
              <div className="text-center">
                <p className="font-bold" style={{ color: "var(--cc-text-primary)" }}>{stats?.requestsWeek ?? 0}</p>
                <p className="text-xs" style={{ color: "var(--cc-text-tertiary)" }}>This week</p>
              </div>
            </div>
          </div>
          <Sparkline data={stats?.dailyRequests ?? []} />
          <div className="flex justify-between mt-1">
            <p className="text-xs" style={{ color: "var(--cc-text-tertiary)" }}>14 days ago</p>
            <p className="text-xs" style={{ color: "var(--cc-text-tertiary)" }}>Today</p>
          </div>
        </div>

        {/* Top users */}
        <div className="p-6 rounded-2xl" style={{ background: "var(--cc-surface)", border: "1px solid var(--cc-border)" }}>
          <h2 className="font-bold mb-4 flex items-center gap-2" style={{ color: "var(--cc-text-primary)" }}>
            <Users className="w-4 h-4" style={{ color: "#ff6b35" }} />
            Top Users This Week
          </h2>
          {!stats?.topUsers?.length ? (
            <p className="text-sm" style={{ color: "var(--cc-text-tertiary)" }}>No requests yet this week.</p>
          ) : (
            <div className="space-y-2">
              {stats.topUsers.map((u, i) => (
                <div key={u.user_id} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: "var(--cc-surface-2)", border: "1px solid var(--cc-border)" }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold w-4" style={{ color: "var(--cc-text-tertiary)" }}>{i + 1}</span>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: "rgba(255,107,53,0.15)", color: "#ff6b35" }}>
                      {u.email[0].toUpperCase()}
                    </div>
                    <p className="text-sm font-medium" style={{ color: "var(--cc-text-primary)" }}>{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.is_pro && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(255,107,53,0.15)", color: "#ff6b35", border: "1px solid rgba(255,107,53,0.25)" }}>
                        Pro
                      </span>
                    )}
                    <span className="text-sm font-bold" style={{ color: "var(--cc-text-primary)" }}>
                      {u.total_requests} req
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Feature Flags */}
        <FeatureFlagsPanel />
      </main>
    </div>
  );
}

function FeatureFlagsPanel() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newId, setNewId] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchFlags = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/flags");
      const data = await res.json();
      setFlags(data.flags ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchFlags(); }, []);

  const handleToggle = async (id: string, enabled: boolean) => {
    setToggling(id);
    try {
      const res = await fetch("/api/admin/flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      if (res.ok) {
        setFlags((prev) => prev.map((f) => (f.id === id ? { ...f, enabled } : f)));
        invalidateFlagCache();
      }
    } finally { setToggling(null); }
  };

  const handleCreate = async () => {
    const trimmed = newId.trim().toLowerCase().replace(/\s+/g, "_");
    if (!trimmed) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: trimmed, enabled: false, description: newDesc || null }),
      });
      if (res.ok) {
        const data = await res.json();
        setFlags((prev) => [...prev, data.flag]);
        setNewId("");
        setNewDesc("");
        setShowNew(false);
        invalidateFlagCache();
      }
    } finally { setCreating(false); }
  };

  return (
    <div className="p-6 rounded-2xl" style={{ background: "var(--cc-surface)", border: "1px solid var(--cc-border)" }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold flex items-center gap-2" style={{ color: "var(--cc-text-primary)" }}>
          <Flag className="w-4 h-4" style={{ color: "#ff6b35" }} />
          Feature Flags
        </h2>
        <button
          onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
          style={{ background: "var(--cc-surface-2)", color: "var(--cc-text-secondary)", border: "1px solid var(--cc-border)" }}
        >
          <Plus className="w-3 h-3" />
          New flag
        </button>
      </div>

      {showNew && (
        <div className="mb-4 p-4 rounded-xl space-y-3" style={{ background: "var(--cc-surface-2)", border: "1px solid var(--cc-border)" }}>
          <input
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="flag_id (e.g. mcp_doordash)"
            className="w-full px-3 py-2 text-sm rounded-lg"
            style={{ background: "var(--cc-surface)", border: "1px solid var(--cc-border)", color: "var(--cc-text-primary)" }}
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 text-sm rounded-lg"
            style={{ background: "var(--cc-surface)", border: "1px solid var(--cc-border)", color: "var(--cc-text-primary)" }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !newId.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full disabled:opacity-50"
              style={{ background: "#ff6b35", color: "#fff" }}
            >
              {creating && <Loader2 className="w-3 h-3 animate-spin" />}
              Create
            </button>
            <button
              onClick={() => { setShowNew(false); setNewId(""); setNewDesc(""); }}
              className="px-4 py-2 text-xs rounded-full"
              style={{ color: "var(--cc-text-secondary)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--cc-text-tertiary)" }} />
        </div>
      ) : flags.length === 0 ? (
        <p className="text-sm py-4" style={{ color: "var(--cc-text-tertiary)" }}>
          No feature flags found. Run the migration SQL first.
        </p>
      ) : (
        <div className="space-y-2">
          {flags.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: "var(--cc-surface-2)", border: "1px solid var(--cc-border)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-semibold" style={{ color: "var(--cc-text-primary)" }}>{f.id}</code>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: f.enabled ? "#34c759" : "var(--cc-text-tertiary)",
                      background: f.enabled ? "rgba(52,199,89,0.10)" : "var(--cc-surface)",
                      padding: "1px 6px",
                      borderRadius: "980px",
                      textTransform: "uppercase",
                    }}
                  >
                    {f.enabled ? "ON" : "OFF"}
                  </span>
                </div>
                {f.description && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--cc-text-tertiary)" }}>
                    {f.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleToggle(f.id, !f.enabled)}
                disabled={toggling === f.id}
                aria-label={`Toggle ${f.id}`}
                className="ml-3 shrink-0 relative w-10 h-6 rounded-full transition-colors"
                style={{ background: f.enabled ? "#34c759" : "var(--cc-surface)" }}
              >
                {toggling === f.id ? (
                  <Loader2 className="w-3.5 h-3.5 absolute animate-spin" style={{ top: "5px", left: f.enabled ? "19px" : "3px", color: f.enabled ? "#fff" : "var(--cc-text-tertiary)" }} />
                ) : (
                  <span
                    className="absolute top-0.5 rounded-full w-5 h-5 bg-white shadow-sm transition-transform"
                    style={{ left: f.enabled ? "18px" : "2px" }}
                  />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
