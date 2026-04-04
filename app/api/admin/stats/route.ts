import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export async function GET() {
  // Auth check
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Admin gate — must match ADMIN_EMAIL env var
  if (!ADMIN_EMAIL || user.email !== ADMIN_EMAIL) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

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
