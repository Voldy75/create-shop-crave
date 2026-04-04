"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import { ArrowLeft, Users, Zap, Crown, TrendingUp, BarChart2, RefreshCw, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
  if (data.length === 0) return <div className="h-12 bg-gray-50 rounded-lg" />;
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="flex items-end gap-1 h-12">
      {data.map((d) => (
        <div
          key={d.usage_date}
          className="flex-1 bg-indigo-400 rounded-sm opacity-80 hover:opacity-100 transition-opacity"
          style={{ height: `${Math.max(4, (d.total / max) * 100)}%` }}
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
  color,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
}) {
  return (
    <Card className="p-5 border border-gray-100 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
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
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin || error === "forbidden") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-6 p-8">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
          <Lock className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Access Only</h1>
        <p className="text-gray-500">This page is restricted to the app owner.</p>
        <Button onClick={() => router.push("/chat")} variant="outline" className="rounded-full">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Chat
        </Button>
      </div>
    );
  }

  const conversionRate = stats && stats.totalUsers > 0
    ? ((stats.proCount / stats.totalUsers) * 100).toFixed(1)
    : "0";

  const mrr = stats ? stats.proCount * 9 : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/chat")}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div>
            <h1 className="font-bold text-lg text-gray-900">Admin Dashboard</h1>
            <p className="text-xs text-gray-400">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <Button
          onClick={fetchStats}
          disabled={loading}
          variant="outline"
          className="rounded-full text-xs h-8 gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-8">
        {error && error !== "forbidden" && (
          <div className="bg-red-50 text-red-600 rounded-xl p-4 text-sm">{error}</div>
        )}

        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Total Users"
            value={stats?.totalUsers ?? 0}
            color="bg-blue-50 text-blue-600"
          />
          <StatCard
            icon={Zap}
            label="DAU"
            value={stats?.dau ?? 0}
            sub="active today"
            color="bg-indigo-50 text-indigo-600"
          />
          <StatCard
            icon={Crown}
            label="Pro Subscribers"
            value={stats?.proCount ?? 0}
            sub={`${conversionRate}% conversion`}
            color="bg-amber-50 text-amber-600"
          />
          <StatCard
            icon={TrendingUp}
            label="Est. MRR"
            value={`$${mrr}`}
            sub={`₹${mrr * 84} / month`}
            color="bg-green-50 text-green-600"
          />
        </div>

        {/* Request stats + sparkline */}
        <Card className="p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-indigo-600" />
              <h2 className="font-bold text-gray-900">AI Requests</h2>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <p className="font-bold text-gray-900">{stats?.requestsToday ?? 0}</p>
                <p className="text-xs text-gray-400">Today</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-900">{stats?.requestsWeek ?? 0}</p>
                <p className="text-xs text-gray-400">This week</p>
              </div>
            </div>
          </div>
          <Sparkline data={stats?.dailyRequests ?? []} />
          <div className="flex justify-between mt-1">
            <p className="text-xs text-gray-400">14 days ago</p>
            <p className="text-xs text-gray-400">Today</p>
          </div>
        </Card>

        {/* Top users */}
        <Card className="p-6 border border-gray-100 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            Top Users This Week
          </h2>
          {!stats?.topUsers?.length ? (
            <p className="text-sm text-gray-400">No requests yet this week.</p>
          ) : (
            <div className="space-y-2">
              {stats.topUsers.map((u, i) => (
                <div
                  key={u.user_id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">
                      {u.email[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.is_pro && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                        Pro
                      </span>
                    )}
                    <span className="text-sm font-bold text-gray-900">
                      {u.total_requests} req
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
