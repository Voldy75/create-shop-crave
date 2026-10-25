/**
 * Bo's task store and per-task metering. Tables and RPCs:
 * scripts/sql/agent-tasks.sql.
 *
 * METERING IS PER TASK, NOT PER MESSAGE. One request ("something spicy for
 * dinner, 2 people") becomes one agent_tasks row and is counted once, at
 * creation, however many model calls and turns it takes. A task is then
 * bounded by step caps instead — per turn (handed to the SDK's stopWhen) and
 * per task (agent_task_record_steps) — so one task cannot run up unbounded
 * model cost.
 *
 * WHERE THE NUMBERS COME FROM:
 *   tasks per day  plans.features.bo_tasks_daily (Admin → Plans; null =
 *                  unlimited) → app_config['bo.limits'].tasks_daily →
 *                  BO_FALLBACK below. Restricted/banned users get 0.
 *   step caps      app_config['bo.limits'] → BO_FALLBACK.
 * Like lib/limits.ts, every failure lands on the fallback — never unlimited.
 *
 * LOGGING: user ids are hashed (logId) and tool payloads are never logged or
 * stored whole — events carry a short summary and minimised data.
 *
 * Service-role only. Callers authenticate the user first.
 */

import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveLimits } from "@/lib/limits";

export type TaskMode = "undecided" | "cook" | "order" | "dine_in" | "grocery";
export type TaskStatus =
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "awaiting_payment"
  | "tracking"
  | "done"
  | "failed"
  | "cancelled";
export type TaskEventKind =
  | "status"
  | "tool_call"
  | "tool_result"
  | "approval_requested"
  | "approval_granted"
  | "approval_rejected"
  | "message"
  | "error";

export interface BoLimits {
  /** null = unlimited, 0 = blocked */
  tasksDaily: number | null;
  maxStepsPerTask: number;
  maxStepsPerTurn: number;
}

const BO_FALLBACK = { tasks_daily: 3, max_steps_per_task: 24, max_steps_per_turn: 8 };
const CACHE_TTL_MS = 60_000;

let configCache: { at: number; value: typeof BO_FALLBACK } | null = null;
let planFeatureCache: { at: number; value: Map<string, number | null | undefined> } | null = null;

/** Correlation id for logs: stable per user, not reversible to the id. */
export function logId(userId: string): string {
  return createHash("sha256").update(`bo:${userId}`).digest("hex").slice(0, 12);
}

const posInt = (v: unknown, d: number) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : d);

async function loadConfig(): Promise<typeof BO_FALLBACK> {
  if (configCache && Date.now() - configCache.at < CACHE_TTL_MS) return configCache.value;
  const sb = await createServiceClient();
  const { data, error } = await sb.from("app_config").select("value").eq("key", "bo.limits").maybeSingle();
  if (error || !data?.value) {
    if (error) console.error("bo limits: app_config read failed:", error.message);
    return BO_FALLBACK;
  }
  const v = data.value as Partial<typeof BO_FALLBACK>;
  const value = {
    tasks_daily: typeof v.tasks_daily === "number" && v.tasks_daily >= 0 ? v.tasks_daily : BO_FALLBACK.tasks_daily,
    max_steps_per_task: posInt(v.max_steps_per_task, BO_FALLBACK.max_steps_per_task),
    max_steps_per_turn: posInt(v.max_steps_per_turn, BO_FALLBACK.max_steps_per_turn),
  };
  configCache = { at: Date.now(), value };
  return value;
}

/** plan id → features.bo_tasks_daily: number, null (unlimited) or undefined (unset). */
async function loadPlanTaskLimits(): Promise<Map<string, number | null | undefined>> {
  if (planFeatureCache && Date.now() - planFeatureCache.at < CACHE_TTL_MS) return planFeatureCache.value;
  const sb = await createServiceClient();
  const { data, error } = await sb.from("plans").select("id, features").eq("is_active", true);
  if (error || !data) {
    if (error) console.error("bo limits: plans read failed:", error.message);
    return new Map();
  }
  const value = new Map<string, number | null | undefined>();
  for (const p of data) {
    const f = (p.features ?? {}) as Record<string, unknown>;
    const raw = f.bo_tasks_daily;
    value.set(p.id as string, raw === null ? null : typeof raw === "number" && raw >= 0 ? raw : undefined);
  }
  planFeatureCache = { at: Date.now(), value };
  return value;
}

export async function resolveBoLimits(userId: string): Promise<BoLimits> {
  try {
    const [base, config, plans] = await Promise.all([resolveLimits(userId), loadConfig(), loadPlanTaskLimits()]);
    const caps = { maxStepsPerTask: config.max_steps_per_task, maxStepsPerTurn: config.max_steps_per_turn };
    if (base.status === "restricted" || base.status === "banned") return { tasksDaily: 0, ...caps };
    const planValue = plans.get(base.planId);
    return { tasksDaily: planValue === undefined ? config.tasks_daily : planValue, ...caps };
  } catch (e) {
    console.error("bo limits: unexpected failure:", e);
    return {
      tasksDaily: BO_FALLBACK.tasks_daily,
      maxStepsPerTask: BO_FALLBACK.max_steps_per_task,
      maxStepsPerTurn: BO_FALLBACK.max_steps_per_turn,
    };
  }
}

export type CreateTaskResult =
  | { ok: true; taskId: string; used: number; limit: number | null; limits: BoLimits }
  | { ok: false; reason: "quota"; used: number; limit: number | null };

/**
 * Start a task: spend one unit of today's task quota, then create the row.
 * Unlike chat, this fails CLOSED on a quota RPC error — a task can place
 * orders, so an infrastructure hiccup must not hand out unmetered tasks.
 */
export async function createTask(userId: string, intent: string, mode: TaskMode = "undecided"): Promise<CreateTaskResult> {
  const limits = await resolveBoLimits(userId);
  if (limits.tasksDaily === 0) return { ok: false, reason: "quota", used: 0, limit: 0 };

  const sb = await createServiceClient();
  const today = new Date().toISOString().split("T")[0];
  const { data: quota, error: quotaError } = await sb.rpc("check_and_increment_task_usage", {
    p_user_id: userId,
    p_date: today,
    p_limit: limits.tasksDaily,
  });
  if (quotaError) throw new Error(`task quota check failed: ${quotaError.message}`);
  const used = (quota?.count as number | undefined) ?? 0;
  if (!quota?.allowed) return { ok: false, reason: "quota", used, limit: limits.tasksDaily };

  const { data, error } = await sb
    .from("agent_tasks")
    .insert({ user_id: userId, intent: intent.trim().slice(0, 500), mode })
    .select("id")
    .single();
  if (error || !data) throw new Error(`task create failed: ${error?.message ?? "no row"}`);
  await addTaskEvent(userId, data.id as string, "status", { summary: "planning" });
  return { ok: true, taskId: data.id as string, used, limit: limits.tasksDaily, limits };
}

export interface TaskRow {
  id: string;
  intent: string;
  mode: TaskMode;
  status: TaskStatus;
  plan: Record<string, unknown>;
  steps: number;
  tool_calls: number;
  created_at: string;
  updated_at: string;
}

/** The user's own task, or null (also for someone else's id). */
export async function getTask(userId: string, taskId: string): Promise<TaskRow | null> {
  const sb = await createServiceClient();
  const { data, error } = await sb
    .from("agent_tasks")
    .select("id, intent, mode, status, plan, steps, tool_calls, created_at, updated_at")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`task read failed: ${error.message}`);
  return (data as TaskRow | null) ?? null;
}

export async function updateTask(
  userId: string,
  taskId: string,
  fields: { status?: TaskStatus; mode?: TaskMode; plan?: Record<string, unknown> }
): Promise<void> {
  const sb = await createServiceClient();
  const { error } = await sb
    .from("agent_tasks")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", userId);
  if (error) throw new Error(`task update failed: ${error.message}`);
  if (fields.status) await addTaskEvent(userId, taskId, "status", { summary: fields.status });
}

/**
 * Record a turn's spend. Returns whether the task has now reached its cap, so
 * the caller can stop starting new turns. A task id that is not the user's
 * reports overCap: true — it can never be charged or continued.
 */
export async function recordTaskSteps(
  userId: string,
  taskId: string,
  steps: number,
  toolCalls: number,
  maxStepsPerTask: number
): Promise<{ steps: number; overCap: boolean }> {
  const sb = await createServiceClient();
  const { data, error } = await sb.rpc("agent_task_record_steps", {
    p_task_id: taskId,
    p_user_id: userId,
    p_steps: steps,
    p_tool_calls: toolCalls,
    p_max_steps: maxStepsPerTask,
  });
  if (error) {
    console.error(`bo[${logId(userId)}] record steps failed:`, error.message);
    return { steps: 0, overCap: true }; // fail closed
  }
  return { steps: (data?.steps as number) ?? 0, overCap: data?.over_cap !== false };
}

const SUMMARY_MAX = 500;

/** Append to a task's timeline. Best effort: a failed write is logged, never thrown. */
export async function addTaskEvent(
  userId: string,
  taskId: string,
  kind: TaskEventKind,
  opts: { tool?: string; summary?: string; data?: Record<string, unknown> } = {}
): Promise<void> {
  const sb = await createServiceClient();
  const { error } = await sb.from("agent_task_events").insert({
    task_id: taskId,
    user_id: userId,
    kind,
    tool: opts.tool ?? null,
    summary: opts.summary ? opts.summary.slice(0, SUMMARY_MAX) : null,
    data: opts.data ?? null,
  });
  if (error) console.error(`bo[${logId(userId)}] event ${kind} failed:`, error.message);
}

/**
 * Bo's FIRST approval request for this tool call on this task — with the cart
 * fingerprint the user saw on the card, when there is a cart — or null if
 * there was none (or the task is not the user's). First, not latest: the SDK
 * runs toolApproval again on the turn that carries the user's answer.
 */
export async function findApprovalRequest(
  userId: string,
  taskId: string,
  toolCallId: string
): Promise<{ fingerprint: string | null } | null> {
  const sb = await createServiceClient();
  const { data, error } = await sb
    .from("agent_task_events")
    .select("data")
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .eq("kind", "approval_requested")
    .eq("data->>toolCallId", toolCallId)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`approval read failed: ${error.message}`);
  if (!data) return null;
  const fp = (data.data as { fingerprint?: unknown } | null)?.fingerprint;
  return { fingerprint: typeof fp === "string" ? fp : null };
}
