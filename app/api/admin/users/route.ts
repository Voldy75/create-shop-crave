import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-guard";

/**
 * GET /api/admin/users
 *
 * Cursor-paginated user list for the admin console. Uses keyset pagination on
 * (created_at desc, user_id desc) rather than offset, since offset pagination
 * rots as rows are inserted mid-scroll (see the index comment in
 * scripts/sql/admin-console.sql).
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function encodeCursor(createdAt: string, userId: string): string {
  return Buffer.from(`${createdAt}|${userId}`, "utf8").toString("base64");
}

function decodeCursor(cursor: string): { createdAt: string; userId: string } | null {
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    const sep = decoded.lastIndexOf("|");
    if (sep === -1) return null;
    const createdAt = decoded.slice(0, sep);
    const userId = decoded.slice(sep + 1);
    if (!createdAt || !userId) return null;
    return { createdAt, userId };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || null;
  const status = url.searchParams.get("status");
  const plan = url.searchParams.get("plan");
  const platform = url.searchParams.get("platform");
  const cursorParam = url.searchParams.get("cursor");

  let limit = DEFAULT_LIMIT;
  const limitParam = url.searchParams.get("limit");
  if (limitParam) {
    const parsed = Number.parseInt(limitParam, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(parsed, MAX_LIMIT);
    }
  }

  if (status && !["active", "restricted", "banned"].includes(status)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }
  if (
    platform &&
    !["web", "ios", "android"].includes(platform)
  ) {
    return Response.json({ error: "Invalid platform" }, { status: 400 });
  }

  let cursor: { createdAt: string; userId: string } | null = null;
  if (cursorParam) {
    cursor = decodeCursor(cursorParam);
    if (!cursor) {
      return Response.json({ error: "Invalid cursor" }, { status: 400 });
    }
  }

  const svc = await createServiceClient();

  let query = svc
    .from("user_profiles")
    .select(
      "user_id, email, display_name, role, status, status_reason, status_changed_at, plan_id, first_seen_platform, last_seen_platform, last_seen_at, created_at"
    )
    .order("created_at", { ascending: false })
    .order("user_id", { ascending: false })
    .limit(limit);

  if (q) {
    query = query.ilike("email", `%${q}%`);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (plan) {
    query = query.eq("plan_id", plan);
  }
  if (platform) {
    query = query.eq("last_seen_platform", platform);
  }
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},user_id.lt.${cursor.userId})`
    );
  }

  const { data: users, error } = await query;
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const rows = users ?? [];
  const ids = rows.map((u) => u.user_id);

  let usageByUser = new Map<string, number>();
  if (ids.length > 0) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 6); // last 7 days inclusive of today
    const sinceDate = since.toISOString().slice(0, 10);

    const { data: usageRows, error: usageError } = await svc
      .from("usage")
      .select("user_id, count")
      .in("user_id", ids)
      .gte("usage_date", sinceDate);

    if (usageError) {
      console.error("admin/users: usage read failed:", usageError.message);
    } else {
      usageByUser = new Map();
      for (const row of usageRows ?? []) {
        usageByUser.set(row.user_id, (usageByUser.get(row.user_id) ?? 0) + (row.count ?? 0));
      }
    }
  }

  const usersWithUsage = rows.map((u) => ({
    ...u,
    chat_usage_7d: usageByUser.get(u.user_id) ?? 0,
  }));

  const nextCursor =
    rows.length < limit
      ? null
      : encodeCursor(
          rows[rows.length - 1].created_at as string,
          rows[rows.length - 1].user_id as string
        );

  return Response.json({ users: usersWithUsage, nextCursor });
}
