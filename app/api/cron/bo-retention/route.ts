/**
 * Bo retention cron — daily via vercel.json. Deletes agent tasks past their
 * expires_at (90 days; scripts/sql/agent-tasks.sql) together with their
 * events. DPDP purpose limitation: task history is kept only as long as it is
 * useful to the user.
 *
 * Runs whatever the bo_agent flag says: data written while the flag was on
 * must still expire after it is switched off.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` (sent by Vercel Cron), same as
 * daily-nudge. No ?token= fallback — this one deletes data.
 */

import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sb = await createServiceClient();
  const { data, error } = await sb.rpc("purge_expired_agent_tasks");
  if (error) {
    console.error("bo-retention: purge failed:", error.message);
    return Response.json({ error: "purge_failed" }, { status: 500 });
  }
  return Response.json({ purged: data ?? 0 });
}
