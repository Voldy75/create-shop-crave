import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-guard";

/**
 * Admin dashboard numbers (WF12 w12a).
 *
 * Added for WF12, because the board's tiles need data the old response did not
 * carry — and the old dashboard filled the gap with invention:
 *   - paidByProvider + proPrices: "Est. MRR" used to be proCount × $9, then a
 *     HARDCODED 84 rupees-per-dollar. A Razorpay pass is ₹749 per 31 days, not
 *     $9, and the rate was stale on day one. The board's ₹299 is a third wrong
 *     number. Revenue is now each provider's count × its own price, in its own
 *     currency, straight from plan_prices — no conversion.
 *   - usersByPlatform: the board splits users by web / iOS / Android. This is
 *     user_profiles.first_seen_platform, a real column. (No native binary has
 *     shipped, so iOS and Android will honestly read 0.)
 *   - dailyRequests is now ZERO-FILLED: the RPC returns only days that had
 *     usage, so a quiet day used to vanish from the chart instead of dipping.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  const svc = await createServiceClient();
  const DAYS = 14;

  const [dau, totalUsers, proCount, requestsToday, requestsWeek, dailyRequests, topUsers, subs, prices, platforms] =
    await Promise.all([
      svc.rpc("admin_dau"),
      svc.rpc("admin_total_users"),
      svc.rpc("admin_pro_count"),
      svc.rpc("admin_requests_today"),
      svc.rpc("admin_requests_week"),
      svc.rpc("admin_daily_requests", { days_back: DAYS - 1 }),
      svc.rpc("admin_top_users", { lim: 10 }),
      // Same "active" definition as admin_pro_count: active and not expired.
      svc.from("pro_subscriptions").select("provider, current_period_end").eq("status", "active"),
      svc.from("plan_prices").select("provider, amount_minor, currency, interval").eq("plan_id", "pro").eq("platform", "web").eq("is_active", true),
      svc.from("user_profiles").select("first_seen_platform"),
    ]);

  const now = Date.now();
  const paidByProvider: Record<string, number> = {};
  for (const s of (subs.data ?? []) as { provider: string; current_period_end: string | null }[]) {
    if (s.current_period_end && new Date(s.current_period_end).getTime() <= now) continue;
    paidByProvider[s.provider] = (paidByProvider[s.provider] ?? 0) + 1;
  }

  const usersByPlatform: Record<string, number> = { web: 0, ios: 0, android: 0, unknown: 0 };
  for (const p of (platforms.data ?? []) as { first_seen_platform: string | null }[]) {
    const k = p.first_seen_platform && p.first_seen_platform in usersByPlatform ? p.first_seen_platform : "unknown";
    usersByPlatform[k] += 1;
  }

  // Zero-fill the last DAYS calendar days so gaps read as zero, not as missing.
  const byDate = new Map(
    ((dailyRequests.data ?? []) as { usage_date: string; total: number }[]).map((d) => [d.usage_date, d.total])
  );
  const filled: { usage_date: string; total: number }[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
    filled.push({ usage_date: d, total: byDate.get(d) ?? 0 });
  }

  return Response.json({
    dau: dau.data ?? 0,
    totalUsers: totalUsers.data ?? 0,
    proCount: proCount.data ?? 0,
    requestsToday: requestsToday.data ?? 0,
    requestsWeek: requestsWeek.data ?? 0,
    dailyRequests: filled,
    topUsers: topUsers.data ?? [],
    paidByProvider,
    proPrices: prices.data ?? [],
    usersByPlatform,
    generatedAt: new Date().toISOString(),
  });
}
