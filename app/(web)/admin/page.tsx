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
    <div className="h-12 rounded-lg" style={{ background: "var(--m-cream-2)" }} />
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
            background: "var(--m-forest)",
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
  /** A CSS colour VALUE — pass a `var(--m-*)` token, not a literal. */
  iconColor: string;
}) {
  return (
    <div className="p-5" style={{ background: "var(--m-card)", borderRadius: "12px" }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--m-ink-soft)", letterSpacing: "0.08em" }}>{label}</p>
          <p className="text-3xl font-bold mt-1" style={{ color: "var(--m-ink)", letterSpacing: "-0.03em" }}>{value}</p>
          {sub && <p className="text-xs mt-0.5" style={{ color: "var(--m-ink-soft)" }}>{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: `color-mix(in srgb, ${iconColor} 14%, transparent)`,
            color: iconColor,
          }}>
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
      <div className="flex items-center justify-center h-screen" style={{ background: "var(--m-cream)" }}>
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "var(--m-forest)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  const conversionRate = stats && stats.totalUsers > 0
    ? ((stats.proCount / stats.totalUsers) * 100).toFixed(1)
    : "0";

  const mrr = stats ? stats.proCount * 9 : 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--m-cream)" }}>
      <header className="glass-nav px-6 flex items-center justify-between sticky top-0 z-10" style={{ height: "48px" }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/chat")}
            className="p-2 rounded-full transition-colors text-[var(--m-ink-soft)] hover:bg-[var(--m-cream-2)]"
            aria-label="Back to chat"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-bold text-lg" style={{ color: "var(--m-ink)", letterSpacing: "-0.02em" }}>
              Admin Dashboard
            </h1>
            <p className="text-xs" style={{ color: "var(--m-ink-soft)" }}>
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
            style={{
              background: "color-mix(in srgb, var(--m-red) 10%, transparent)",
              color: "var(--m-red)",
              border: "1.5px solid color-mix(in srgb, var(--m-red) 22%, transparent)",
            }}>
            {error}
          </div>
        )}

        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Users" value={stats?.totalUsers ?? 0} iconColor="var(--m-plum)" />
          <StatCard icon={Zap} label="DAU" value={stats?.dau ?? 0} sub="active today" iconColor="var(--m-forest)" />
          <StatCard icon={Crown} label="Pro Subscribers" value={stats?.proCount ?? 0} sub={`${conversionRate}% conversion`} iconColor="var(--m-burnt)" />
          <StatCard icon={TrendingUp} label="Est. MRR" value={`$${mrr}`} sub={`₹${mrr * 84} / month`} iconColor="var(--m-lime)" />
        </div>

        {/* Request stats + sparkline */}
        <div className="p-6 rounded-2xl" style={{ background: "var(--m-card)", border: "1px solid var(--m-ink-faint)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4" style={{ color: "var(--m-forest)" }} />
              <h2 className="font-bold" style={{ color: "var(--m-ink)" }}>AI Requests</h2>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <p className="font-bold" style={{ color: "var(--m-ink)" }}>{stats?.requestsToday ?? 0}</p>
                <p className="text-xs" style={{ color: "var(--m-ink-soft)" }}>Today</p>
              </div>
              <div className="text-center">
                <p className="font-bold" style={{ color: "var(--m-ink)" }}>{stats?.requestsWeek ?? 0}</p>
                <p className="text-xs" style={{ color: "var(--m-ink-soft)" }}>This week</p>
              </div>
            </div>
          </div>
          <Sparkline data={stats?.dailyRequests ?? []} />
          <div className="flex justify-between mt-1">
            <p className="text-xs" style={{ color: "var(--m-ink-soft)" }}>14 days ago</p>
            <p className="text-xs" style={{ color: "var(--m-ink-soft)" }}>Today</p>
          </div>
        </div>

        {/* Top users */}
        <div className="p-6 rounded-2xl" style={{ background: "var(--m-card)", border: "1px solid var(--m-ink-faint)" }}>
          <h2 className="font-bold mb-4 flex items-center gap-2" style={{ color: "var(--m-ink)" }}>
            <Users className="w-4 h-4" style={{ color: "var(--m-forest)" }} />
            Top Users This Week
          </h2>
          {!stats?.topUsers?.length ? (
            <p className="text-sm" style={{ color: "var(--m-ink-soft)" }}>No requests yet this week.</p>
          ) : (
            <div className="space-y-2">
              {stats.topUsers.map((u, i) => (
                <div key={u.user_id} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: "var(--m-cream-2)", border: "1px solid var(--m-ink-faint)" }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold w-4" style={{ color: "var(--m-ink-soft)" }}>{i + 1}</span>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: "var(--m-tint-green)", color: "var(--m-forest)" }}>
                      {u.email[0].toUpperCase()}
                    </div>
                    <p className="text-sm font-medium" style={{ color: "var(--m-ink)" }}>{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.is_pro && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "var(--m-tint-green)", color: "var(--m-forest)" }}>
                        Pro
                      </span>
                    )}
                    <span className="text-sm font-bold" style={{ color: "var(--m-ink)" }}>
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
