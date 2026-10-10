import { strToU8, zipSync } from "fflate";
import { requireUser } from "@/lib/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 30;

/**
 * Build the user's data export as one ZIP, in this request.
 *
 * GENERATED ON REQUEST, NOT QUEUED (decided 2026-10-03). The boards draw a
 * "leave and come back — it'll be here when ready" state, which implies a
 * persisted job and stored file. This product's data is small enough to build
 * in one request, so the screen shows a real "Preparing" for the seconds this
 * takes and then hands over the file — and never claims it will wait for you.
 *
 * TWO SOURCES, because the data genuinely lives in two places:
 *   - server rows, read here with the service client, scoped to this user;
 *   - this browser's localStorage (saved recipes, meal plan, diet, tastes,
 *     goal), which the server cannot see, so the client sends it in the body.
 * The README inside the ZIP says which is which, and that other devices keep
 * their own local copy.
 *
 * NEVER EXPORTED, deliberately: OAuth access tokens (mcp_connections), web
 * push keys (notification_subscriptions.web_push_subscription), notification
 * payloads, and the admin-only moderation fields on user_profiles — the same
 * columns the app already refuses to show the user through PostgREST.
 */

const MAX_LOCAL_BYTES = 2_000_000;

type Row = Record<string, unknown>;

function csv(rows: Row[], columns: string[]): string {
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))].join("\n") + "\n";
}

const json = (v: unknown) => strToU8(JSON.stringify(v, null, 2) + "\n");

export async function POST(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "unsupported_media_type" }, { status: 415 });
  }
  const guard = await requireUser();
  if (guard instanceof Response) return guard;
  const { user } = guard;

  const raw = await req.text();
  if (raw.length > MAX_LOCAL_BYTES) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }
  let local: Row = {};
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed.local === "object" && parsed.local !== null) local = parsed.local;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const sb = await createServiceClient();
  const uid = user.id;
  const [profile, mealLogs, goals, notif, notifLog, conns, subs, usage, usagePhoto] = await Promise.all([
    sb.from("user_profiles")
      .select("email, display_name, plan_id, first_seen_platform, last_seen_platform, last_seen_at, created_at")
      .eq("user_id", uid)
      .maybeSingle(),
    sb.from("meal_logs")
      .select("date, meal_type, source, name, calories, protein, carbs, fat, notes, logged_at")
      .eq("user_id", uid)
      .order("logged_at", { ascending: true }),
    sb.from("nutrition_goals").select("daily_calories, protein, carbs, fat, goal, profile, updated_at").eq("user_id", uid).maybeSingle(),
    sb.from("notification_subscriptions")
      .select("web_push_enabled, whatsapp_enabled, whatsapp_status, created_at, updated_at")
      .eq("user_id", uid)
      .maybeSingle(),
    sb.from("notification_log").select("channel, sent_at, status, send_date").eq("user_id", uid).order("sent_at", { ascending: true }),
    sb.from("mcp_connections").select("provider_id, scope, expires_at, granted_at").eq("user_id", uid),
    sb.from("pro_subscriptions").select("provider, status, current_period_end, created_at").eq("user_id", uid).maybeSingle(),
    sb.from("usage").select("usage_date, count").eq("user_id", uid).order("usage_date", { ascending: true }),
    sb.from("usage_photo").select("usage_date, count").eq("user_id", uid).order("usage_date", { ascending: true }),
  ]);

  const logs = (mealLogs.data ?? []) as Row[];
  const favorites = Array.isArray(local.favorites) ? (local.favorites as Row[]) : [];
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10);

  const readme = [
    "meshi — your data",
    `Exported ${now.toISOString()} for ${user.email ?? "your account"}.`,
    "",
    "FROM YOUR ACCOUNT (our servers)",
    "  account.json            your profile",
    "  meal_logs.json / .csv   every meal you logged",
    "  nutrition_goals.json    calorie and macro targets",
    "  notifications.json      which channels are on, and the delivery log",
    "  connections.json        connected store accounts (no access tokens)",
    "  subscription.json       your meshi+ status",
    "  usage.json              daily Bo request counts",
    "",
    "FROM THIS BROWSER",
    "  this_device.json        saved recipes, meal plan, diet, allergies, tastes",
    "                          and weight goal as stored in this browser",
    "  saved_recipes.csv       the same saved recipes as a table",
    "",
    "Saved recipes and preferences are kept in your browser, not on our servers.",
    "Other browsers or phones you have used keep their own copy, which is not in",
    "this file. Access tokens and push-notification keys are never exported.",
    "",
  ].join("\n");

  const files: Record<string, Uint8Array> = {
    "README.txt": strToU8(readme),
    "account.json": json({ ...(profile.data ?? {}), id: uid }),
    "meal_logs.json": json(logs),
    "meal_logs.csv": strToU8(csv(logs, ["date", "meal_type", "source", "name", "calories", "protein", "carbs", "fat", "notes", "logged_at"])),
    "nutrition_goals.json": json(goals.data ?? null),
    "notifications.json": json({ settings: notif.data ?? null, log: notifLog.data ?? [] }),
    "connections.json": json(conns.data ?? []),
    "subscription.json": json(subs.data ?? null),
    "usage.json": json({ chat: usage.data ?? [], photo: usagePhoto.data ?? [] }),
    "this_device.json": json(local),
    // FavoriteItem is { id, type, data, savedAt } — the name lives on data.
    "saved_recipes.csv": strToU8(
      csv(
        favorites.map((f) => ({
          type: f.type,
          name: (f.data as { name?: unknown } | undefined)?.name ?? "",
          savedAt: f.savedAt,
        })),
        ["type", "name", "savedAt"]
      )
    ),
  };

  const zip = zipSync(files, { level: 6 });
  return new Response(new Uint8Array(zip), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="meshi-export-${stamp}.zip"`,
      "Content-Length": String(zip.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
