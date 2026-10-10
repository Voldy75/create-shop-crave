/**
 * Daily nudge cron — fires every evening at 8 PM IST via vercel.json.
 *
 * For each user with at least one channel enabled:
 *   1. Pull last 7 days of meal_logs + their nutrition_goals
 *   2. Skip if no goals set or already sent today (per IST send_date)
 *   3. Compose a one-line nudge via composeNudge (uses server's default Gemini)
 *   4. Fire on enabled channels (web_push, whatsapp), respecting WhatsApp's
 *      24h window
 *   5. Insert a row into notification_log per channel attempt
 *
 * Auth: header `Authorization: Bearer <CRON_SECRET>` (Vercel cron sends this
 * automatically when CRON_SECRET is set as an env var) OR `?token=<secret>`
 * for manual testing.
 *
 * Returns a JSON summary so manual invocations can see what happened:
 *   { processed, sent: { web_push, whatsapp }, skipped, errors }
 */

import { createServiceClient } from "@/lib/supabase/server";
import { composeNudge, type CoachLog, type CoachGoals } from "@/lib/coach-insights";
import { sendPush } from "@/lib/web-push";
import { sendWhatsApp } from "@/lib/twilio";
import { sendNativePush } from "@/lib/native-push";
import type { PushSubscriptionJSON } from "@/lib/types";

export const maxDuration = 300; // Hobby plan allows up to 300s

interface SubRow {
  user_id: string;
  web_push_enabled: boolean;
  web_push_subscription: PushSubscriptionJSON | null;
  whatsapp_enabled: boolean;
  whatsapp_status: string;
  phone_e164: string | null;
  last_inbound_at: string | null;
  native_push_enabled: boolean;
  native_push_token: string | null;
}

interface GoalsRow {
  daily_calories: number;
  protein: number;
  carbs: number;
  fat: number;
  goal: "lose" | "maintain" | "gain";
}

interface LogRow {
  date: string;
  meal_type: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface RunSummary {
  processed: number;
  sent: { web_push: number; whatsapp: number; native_push: number };
  skipped: number;
  errors: number;
  details?: Array<{ user_id: string; channel: string; status: string; reason?: string }>;
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("token") === secret;
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Return YYYY-MM-DD strings for the last N days (IST), oldest first. */
function lastNDatesIST(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  // IST offset (+5:30) from UTC. We don't need timezone-perfect — the cron
  // fires at 8pm IST, well clear of UTC day boundary either way.
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ist);
    d.setDate(ist.getDate() - i);
    out.push(localDateKey(d));
  }
  return out;
}

function rowsToLogs(rows: LogRow[]): CoachLog[] {
  return rows.map((r) => ({
    date: r.date,
    mealType: r.meal_type,
    name: r.name,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
  }));
}

function rowToGoals(r: GoalsRow): CoachGoals {
  return {
    dailyCalories: r.daily_calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    goal: r.goal,
  };
}

/** Has Twilio's 24h service window closed for this user? */
function whatsappWindowOpen(lastInboundAt: string | null): boolean {
  if (!lastInboundAt) return false;
  const ms = Date.now() - new Date(lastInboundAt).getTime();
  return ms < 24 * 60 * 60 * 1000;
}

export async function POST(req: Request) {
  return handle(req);
}
export async function GET(req: Request) {
  // GET supported for manual smoke-testing via curl; Vercel Cron uses GET by default.
  return handle(req);
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(req.url).searchParams.get("dry") === "1";
  const summary: RunSummary = {
    processed: 0,
    sent: { web_push: 0, whatsapp: 0, native_push: 0 },
    skipped: 0,
    errors: 0,
    details: [],
  };

  const service = await createServiceClient();

  // 1. Fetch all subscribers with at least one channel on.
  const { data: subs, error: subErr } = await service
    .from("notification_subscriptions")
    .select("user_id, web_push_enabled, web_push_subscription, whatsapp_enabled, whatsapp_status, phone_e164, last_inbound_at, native_push_enabled, native_push_token")
    .or("web_push_enabled.eq.true,whatsapp_enabled.eq.true,native_push_enabled.eq.true");
  if (subErr) {
    return Response.json({ error: "subs_lookup_failed", message: subErr.message }, { status: 500 });
  }

  const today = lastNDatesIST(1)[0]; // YYYY-MM-DD for today in IST
  const last7Dates = lastNDatesIST(7);

  for (const subRaw of (subs ?? []) as SubRow[]) {
    summary.processed++;

    // 2. Dedupe: have we already sent on any channel today for this user?
    const { data: sent } = await service
      .from("notification_log")
      .select("channel, status")
      .eq("user_id", subRaw.user_id)
      .eq("send_date", today);
    const alreadySent = new Set((sent ?? []).map((s: { channel: string }) => s.channel));

    // 3. Goals required to compose a meaningful nudge.
    const { data: goalsRow } = await service
      .from("nutrition_goals")
      .select("daily_calories, protein, carbs, fat, goal")
      .eq("user_id", subRaw.user_id)
      .maybeSingle();
    if (!goalsRow) {
      summary.skipped++;
      summary.details?.push({ user_id: subRaw.user_id, channel: "all", status: "skipped", reason: "no_goals" });
      continue;
    }

    // 4. Recent logs (last 7 days).
    const { data: logsRows } = await service
      .from("meal_logs")
      .select("date, meal_type, name, calories, protein, carbs, fat")
      .eq("user_id", subRaw.user_id)
      .gte("date", last7Dates[0])
      .order("date", { ascending: true })
      .limit(60);

    const logs = rowsToLogs((logsRows ?? []) as LogRow[]);
    const goals = rowToGoals(goalsRow as GoalsRow);

    // 5. Compose nudge.
    const nudge = await composeNudge({ logs, goals });
    if (!nudge) {
      summary.errors++;
      summary.details?.push({ user_id: subRaw.user_id, channel: "all", status: "error", reason: "compose_failed" });
      continue;
    }

    // 6. Fire on each enabled channel.
    if (subRaw.web_push_enabled && subRaw.web_push_subscription && !alreadySent.has("web_push")) {
      if (dryRun) {
        summary.details?.push({ user_id: subRaw.user_id, channel: "web_push", status: "would_send" });
      } else {
        const result = await sendPush(subRaw.web_push_subscription, {
          title: nudge.title,
          body: nudge.body,
          url: "/planner?tab=tracker",
          tag: "daily-nudge",
        });
        if (result.gone) {
          await service
            .from("notification_subscriptions")
            .update({ web_push_enabled: false, web_push_subscription: null })
            .eq("user_id", subRaw.user_id);
        }
        await service.from("notification_log").insert({
          user_id: subRaw.user_id,
          channel: "web_push",
          status: result.ok ? "sent" : "failed",
          error: result.ok ? null : `status=${result.status} ${result.error ?? ""}`.slice(0, 200),
          payload: nudge,
        });
        if (result.ok) summary.sent.web_push++;
        else summary.errors++;
      }
    }

    if (subRaw.native_push_enabled && subRaw.native_push_token && !alreadySent.has("native_push")) {
      if (dryRun) {
        summary.details?.push({ user_id: subRaw.user_id, channel: "native_push", status: "would_send" });
      } else {
        const result = await sendNativePush(subRaw.native_push_token, {
          title: nudge.title,
          body: nudge.body,
          url: "/m/plan",
        });
        if (result.notConfigured) {
          // Firebase env not set — skip native delivery without logging noise.
          summary.skipped++;
          summary.details?.push({ user_id: subRaw.user_id, channel: "native_push", status: "skipped", reason: "fcm_not_configured" });
        } else {
          if (result.gone) {
            await service
              .from("notification_subscriptions")
              .update({ native_push_enabled: false, native_push_token: null })
              .eq("user_id", subRaw.user_id);
          }
          await service.from("notification_log").insert({
            user_id: subRaw.user_id,
            channel: "native_push",
            status: result.ok ? "sent" : "failed",
            error: result.ok ? null : `status=${result.status} ${result.error ?? ""}`.slice(0, 200),
            payload: nudge,
          });
          if (result.ok) summary.sent.native_push++;
          else summary.errors++;
        }
      }
    }

    if (subRaw.whatsapp_enabled && subRaw.whatsapp_status === "active" && subRaw.phone_e164 && !alreadySent.has("whatsapp")) {
      // Sandbox 24h window: skip silently if closed (the user can't get this msg).
      if (!whatsappWindowOpen(subRaw.last_inbound_at)) {
        await service.from("notification_log").insert({
          user_id: subRaw.user_id,
          channel: "whatsapp",
          status: "skipped",
          error: "channel_window_closed",
          payload: nudge,
        });
        summary.skipped++;
        summary.details?.push({ user_id: subRaw.user_id, channel: "whatsapp", status: "skipped", reason: "window_closed" });
      } else if (dryRun) {
        summary.details?.push({ user_id: subRaw.user_id, channel: "whatsapp", status: "would_send" });
      } else {
        // Brief weekly reminder to keep window alive — appended to the nudge body.
        const dow = new Date().getDay();
        const remindToReply = dow === 0 ? "\n\nReply OK once a week to keep these going." : "";
        const result = await sendWhatsApp(subRaw.phone_e164, `${nudge.title}\n\n${nudge.body}${remindToReply}`);
        if (result.channelClosed) {
          await service
            .from("notification_subscriptions")
            .update({ whatsapp_status: "pending" })
            .eq("user_id", subRaw.user_id);
        }
        await service.from("notification_log").insert({
          user_id: subRaw.user_id,
          channel: "whatsapp",
          status: result.ok ? "sent" : "failed",
          error: result.ok ? null : `code=${result.code ?? "?"} ${result.error ?? ""}`.slice(0, 200),
          payload: nudge,
        });
        if (result.ok) summary.sent.whatsapp++;
        else summary.errors++;
      }
    }
  }

  return Response.json({ ok: true, summary, dryRun });
}
