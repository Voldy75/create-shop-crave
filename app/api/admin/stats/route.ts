import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-guard";

export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  const svc = await createServiceClient();

  const [dau, totalUsers, proCount, requestsToday, requestsWeek, dailyRequests, topUsers] =
    await Promise.all([
      svc.rpc("admin_dau"),
      svc.rpc("admin_total_users"),
      svc.rpc("admin_pro_count"),
      svc.rpc("admin_requests_today"),
      svc.rpc("admin_requests_week"),
      svc.rpc("admin_daily_requests", { days_back: 14 }),
      svc.rpc("admin_top_users", { lim: 10 }),
    ]);

  return Response.json({
    dau: dau.data ?? 0,
    totalUsers: totalUsers.data ?? 0,
    proCount: proCount.data ?? 0,
    requestsToday: requestsToday.data ?? 0,
    requestsWeek: requestsWeek.data ?? 0,
    dailyRequests: dailyRequests.data ?? [],
    topUsers: topUsers.data ?? [],
  });
}
