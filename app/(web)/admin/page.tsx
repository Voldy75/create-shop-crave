"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, Zap, Crown, TrendingUp, BarChart2, RefreshCw } from "lucide-react";

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
            background: "var(--cc-accent)",
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
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

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
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "var(--cc-bg)" }}>
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "var(--cc-accent)", borderTopColor: "transparent" }} />
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
            className="p-2 rounded-full transition-colors text-[var(--cc-text-secondary)] hover:bg-[var(--cc-surface-2)]"
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
          <StatCard icon={Zap} label="DAU" value={stats?.dau ?? 0} sub="active today" iconColor="var(--cc-accent)" />
          <StatCard icon={Crown} label="Pro Subscribers" value={stats?.proCount ?? 0} sub={`${conversionRate}% conversion`} iconColor="#ffd60a" />
          <StatCard icon={TrendingUp} label="Est. MRR" value={`$${mrr}`} sub={`₹${mrr * 84} / month`} iconColor="#34c759" />
        </div>

        {/* Request stats + sparkline */}
        <div className="p-6 rounded-2xl" style={{ background: "var(--cc-surface)", border: "1px solid var(--cc-border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4" style={{ color: "var(--cc-accent)" }} />
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
            <Users className="w-4 h-4" style={{ color: "var(--cc-accent)" }} />
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
                      style={{ background: "var(--cc-accent-dim)", color: "var(--cc-accent)" }}>
                      {u.email[0].toUpperCase()}
                    </div>
                    <p className="text-sm font-medium" style={{ color: "var(--cc-text-primary)" }}>{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.is_pro && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "var(--cc-accent-dim)", color: "var(--cc-accent)", border: "1px solid rgba(255,107,53,0.25)" }}>
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

      </main>
    </div>
  );
}
