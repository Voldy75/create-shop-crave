"use client";

/**
 * Admin → Dashboard, built to w12a (loading: w12g).
 *
 * Every number is real, and labelled for what it actually measures:
 *   - "Chatted with Bo today" — the board says "Daily actives · Signed in
 *     today", but admin_dau counts users with a usage row today, i.e. who
 *     talked to Bo. Signing in alone writes nothing, so the label says so.
 *   - Est. MRR — active meshi+ per checkout provider × that provider's own
 *     price from plan_prices, in its own currency. The old tile was
 *     count × $9 shown as rupees via a hardcoded 84 rate; the board's ₹299 is
 *     not our price either. A Razorpay pass is one-time per 31 days, so the
 *     tile says "estimate".
 *   - AI requests has no "cap": there is no global daily cap in config.
 */

import { useCallback, useEffect, useState } from "react";
import { AdminError, AdminLoading, AdminTop } from "./admin-shell";

interface DayData { usage_date: string; total: number }
interface TopUser { user_id: string; email: string; total_requests: number; is_pro: boolean }
interface Price { provider: string; amount_minor: number; currency: string; interval: "one_time" | "month" | "year" }

interface Stats {
  dau: number;
  totalUsers: number;
  proCount: number;
  requestsToday: number;
  requestsWeek: number;
  dailyRequests: DayData[];
  topUsers: TopUser[];
  paidByProvider: Record<string, number>;
  proPrices: Price[];
  usersByPlatform: Record<"web" | "ios" | "android" | "unknown", number>;
  generatedAt: string;
}

const PROVIDER_NAME: Record<string, string> = { razorpay: "Razorpay", stripe: "Stripe", apple: "App Store", google: "Play" };

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

function revenue(stats: Stats) {
  const totals = new Map<string, number>();
  const parts: string[] = [];
  let unpriced = 0;
  for (const [provider, count] of Object.entries(stats.paidByProvider)) {
    const price = stats.proPrices.find((p) => p.provider === provider);
    const name = PROVIDER_NAME[provider] ?? provider;
    if (!price) {
      unpriced += count;
      continue;
    }
    // Yearly is spread over 12 months; a 31-day pass is counted as one month.
    const monthly = price.interval === "year" ? Math.round(price.amount_minor / 12) : price.amount_minor;
    totals.set(price.currency, (totals.get(price.currency) ?? 0) + count * monthly);
    const per = price.interval === "one_time" ? " per 31 days" : price.interval === "year" ? "/yr" : "/mo";
    parts.push(`${count} via ${name} × ${money(price.amount_minor, price.currency)}${per}`);
  }
  if (unpriced) parts.push(`${unpriced} with no listed price`);
  const value = totals.size ? [...totals].map(([c, m]) => money(m, c)).join(" + ") : money(0, stats.proPrices[0]?.currency ?? "INR");
  return { value, sub: parts.length ? `${parts.join(" · ")} · estimate` : "No active meshi+ yet" };
}

function Sparkline({ data }: { data: DayData[] }) {
  const W = 860;
  const H = 110;
  const base = 102;
  const max = Math.max(...data.map((d) => d.total), 1);
  const step = data.length > 1 ? W / (data.length - 1) : W;
  const pts = data.map((d, i) => `${(i * step).toFixed(1)},${(base - (d.total / max) * 84).toFixed(1)}`).join(" ");
  const total = data.reduce((s, d) => s + d.total, 0);
  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ display: "block" }}
      role="img"
      aria-label={`AI requests per day for the last ${data.length} days, ${total} in total, peak ${max === 1 && total === 0 ? 0 : max}`}
    >
      <line x1="0" x2={W} y1={base} y2={base} stroke="var(--m-ink-faint)" />
      {data.length > 0 && (
        <>
          <polygon points={`0,${base} ${pts} ${W},${base}`} fill="color-mix(in srgb, var(--figure-accent) 10%, transparent)" />
          <polyline points={pts} fill="none" stroke="var(--figure-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </>
      )}
    </svg>
  );
}

function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub: string }) {
  return (
    <div className="ad-card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="ad-lbl">{label}</span>
      <span className="ad-num">{value}</span>
      <span className="ad-cap">{sub}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <>
      <div className="ad-grid4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="ad-card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 9 }}>
            <span className="ad-sk" style={{ width: 60, height: 10 }} />
            <span className="ad-sk" style={{ width: 70, height: 24 }} />
            <span className="ad-sk" style={{ width: "85%", height: 10 }} />
          </div>
        ))}
      </div>
      <div className="ad-card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <span className="ad-sk" style={{ width: 140, height: 12 }} />
        <span className="ad-sk" style={{ width: "100%", height: 110 }} />
      </div>
      <div className="ad-card" style={{ padding: "4px 0" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="hstack" style={{ gap: 14, padding: "11px 14px" }}>
            <span className="ad-sk" style={{ width: 26, height: 26 }} />
            <span className="ad-sk" style={{ width: "28%", height: 11 }} />
            <span className="ad-sk" style={{ width: "12%", height: 11 }} />
            <div className="grow" />
            <span className="ad-sk" style={{ width: "12%", height: 11 }} />
          </div>
        ))}
      </div>
    </>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error();
      setStats(await res.json());
    } catch {
      setError("Couldn’t load the dashboard. Check your connection and refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
     
    void fetchStats();
  }, [fetchStats]);

  const days = stats?.dailyRequests ?? [];
  const peak = Math.max(0, ...days.map((d) => d.total));
  const total = days.reduce((s, d) => s + d.total, 0);
  const p = stats?.usersByPlatform;
  const rev = stats ? revenue(stats) : null;

  return (
    <>
      <AdminTop title="Dashboard">
        {loading ? (
          <AdminLoading />
        ) : (
          stats && (
            <span className="ad-cap">
              Updated {new Date(stats.generatedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </span>
          )
        )}
        <button type="button" className="ad-btn" onClick={() => void fetchStats()} disabled={loading}>
          Refresh
        </button>
      </AdminTop>
      <div className="ad-body">
        {error && <AdminError>{error}</AdminError>}
        {!stats ? (
          loading && <Skeleton />
        ) : (
          <>
            <div className="ad-grid4">
              <Tile
                label="Users"
                value={stats.totalUsers}
                sub={`${p?.web ?? 0} web · ${p?.ios ?? 0} iOS · ${p?.android ?? 0} Android${p?.unknown ? ` · ${p.unknown} unknown` : ""}`}
              />
              <Tile label="Chatted with Bo" value={stats.dau} sub="Today · used Bo at least once" />
              <Tile label="Est. MRR" value={rev!.value} sub={rev!.sub} />
              <Tile label="AI requests" value={stats.requestsToday} sub={`Today · ${stats.requestsWeek} this week`} />
            </div>

            <div className="ad-card" style={{ padding: "14px 16px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="hstack" style={{ gap: 10, flexWrap: "wrap" }}>
                <h2 className="ad-h">AI requests</h2>
                <span className="ad-cap">Last {days.length} days · daily count</span>
                <div className="grow" />
                <span className="ad-cap">
                  Peak {peak} · total {total}
                </span>
              </div>
              <Sparkline data={days} />
              <div className="hstack" style={{ justifyContent: "space-between" }}>
                <span className="ad-cap" style={{ fontSize: 10.5 }}>{days[0] ? shortDate(days[0].usage_date) : ""}</span>
                <span className="ad-cap" style={{ fontSize: 10.5 }}>{days[7] ? shortDate(days[7].usage_date) : ""}</span>
                <span className="ad-cap" style={{ fontSize: 10.5 }}>Today</span>
              </div>
            </div>

            <div className="ad-card" style={{ overflow: "hidden" }}>
              <div className="hstack" style={{ gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--m-ink-faint)" }}>
                <h2 className="ad-h grow">Most active this week</h2>
                <span className="ad-cap">By AI requests</span>
              </div>
              {stats.topUsers.length === 0 ? (
                <p className="ad-cap" style={{ padding: "18px 14px", margin: 0 }}>No requests yet this week.</p>
              ) : (
                <div className="ad-scroll">
                  <table className="ad-tbl">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Plan</th>
                        <th style={{ textAlign: "right" }}>Requests</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topUsers.map((u) => (
                        <tr key={u.user_id}>
                          <td>
                            <div className="hstack" style={{ gap: 9 }}>
                              <span className="ad-av-sm" aria-hidden>{(u.email?.[0] ?? "?").toUpperCase()}</span>
                              <span style={{ overflowWrap: "anywhere" }}>{u.email}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`ad-pill ${u.is_pro ? "ad-plus" : "ad-mute"}`}>{u.is_pro ? "meshi+" : "Free"}</span>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700 }}>{u.total_requests}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
