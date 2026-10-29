import { streamText, isStepCount, toUIMessageStream, createUIMessageStreamResponse } from "ai";
import { denyIfRestricted } from "@/lib/auth-guard";
import { getServerModel } from "@/lib/providers";
import { activeProviders } from "@/lib/mcp/registry";
import { connectProvider, closeAll, type OpenServer } from "@/lib/mcp/client";
import { callbackUrlFor } from "@/lib/mcp/oauth";
import { ensureFreshConnection } from "@/lib/mcp/connections";
import { readJsonObject, requireBoUser } from "@/lib/bo/guard";
import { getFoodProfile, type FoodProfile } from "@/lib/bo/food-profile";
import { addTaskEvent, createTask, getTask, logId, recordTaskSteps, resolveBoLimits, updateTask, type BoLimits } from "@/lib/bo/tasks";
import { boModelMessages, lastUserText, rejectedApprovals, lastToolName } from "@/lib/bo/messages";
import { boInstructions } from "@/lib/bo/prompt";
import { buildBoTools } from "@/lib/bo/swiggy-tools";

export const maxDuration = 60;

/**
 * Bo, the autonomous food agent (Phase 2). Behind the bo_agent flag: off, this
 * route 404s and /api/agent + /api/chat behave exactly as before.
 *
 * One request = one turn of one TASK (lib/bo/tasks.ts). The first turn
 * creates the task and spends one unit of the daily task quota; later turns
 * send the X-Bo-Task-Id they were given back as `taskId` and cost nothing
 * more, bounded instead by the per-turn and per-task step caps.
 *
 * Money and bookings: see lib/bo/swiggy-tools.ts. Approvals are HMAC-signed
 * with BO_APPROVAL_SECRET; with it unset Bo can still plan and fill carts but
 * cannot order or book.
 *
 * No BYOK here: a task can spend real money, so it always runs on the
 * server model under the task quota.
 */

const TASK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FAILED = "Bo couldn't reach the AI model just now. Please try again in a moment.";

function approvalSecret(): string | null {
  const s = process.env.BO_APPROVAL_SECRET ?? "";
  return s.length >= 32 ? s : null;
}

export async function POST(req: Request) {
  const guard = await requireBoUser();
  if (guard instanceof Response) return guard;
  const { user, profile: account } = guard;
  const restricted = denyIfRestricted(account);
  if (restricted) return restricted;

  const body = await readJsonObject(req);
  if (!body || !Array.isArray(body.messages)) {
    return Response.json({ error: "missing_messages" }, { status: 400 });
  }
  const requestedTask = typeof body.taskId === "string" && TASK_ID.test(body.taskId) ? body.taskId : null;
  if (body.taskId !== undefined && body.taskId !== null && !requestedTask) {
    return Response.json({ error: "invalid_task" }, { status: 400 });
  }

  // Consent decides what Bo may use AND what the task row may keep: without a
  // current consent the profile is not read into the prompt and the intent
  // text is not stored (the row exists only for metering and approvals).
  let foodProfile: FoodProfile | null = null;
  try {
    const { consent, profile } = await getFoodProfile(user.id);
    if (consent.profile && !consent.stale) foodProfile = profile;
  } catch (e) {
    console.error(`bo[${logId(user.id)}] profile read failed:`, e instanceof Error ? e.message : e);
  }

  // Swiggy connection first, so a disconnected user is not charged a task.
  const connected: { providerId: string; accessToken: string }[] = [];
  let sawExpired = false;
  for (const p of await activeProviders()) {
    const result = await ensureFreshConnection(user.id, p, callbackUrlFor(req, p.id));
    if (result.status === "none") continue;
    if (result.status === "expired") {
      sawExpired = true;
      continue;
    }
    connected.push({ providerId: p.id, accessToken: result.connection.accessToken });
  }
  if (connected.length === 0) {
    return Response.json(
      {
        error: "swiggy_reconnect_required",
        message: sawExpired
          ? "Your Swiggy session expired and could not be renewed. Reconnect to keep ordering."
          : "Connect your Swiggy account in Settings → Connections first.",
      },
      { status: 412 }
    );
  }

  // Task: continue the user's own, or start one (spends quota, fails closed).
  let taskId: string;
  let limits: BoLimits;
  let stepsSoFar = 0;
  try {
    if (requestedTask) {
      const task = await getTask(user.id, requestedTask);
      if (!task) return Response.json({ error: "task_not_found" }, { status: 404 });
      taskId = task.id;
      stepsSoFar = task.steps;
      limits = await resolveBoLimits(user.id);
    } else {
      const created = await createTask(user.id, foodProfile ? lastUserText(body.messages) : "");
      if (!created.ok) {
        return Response.json(
          { error: "task_limit_reached", used: created.used, limit: created.limit, message: "You’ve used today’s Bo tasks. Try again tomorrow." },
          { status: 429 }
        );
      }
      taskId = created.taskId;
      limits = created.limits;
    }
  } catch (e) {
    console.error(`bo[${logId(user.id)}] task start failed:`, e instanceof Error ? e.message : e);
    return Response.json({ error: "task_unavailable", message: "Bo is unavailable right now. Please try again." }, { status: 503 });
  }

  if (stepsSoFar >= limits.maxStepsPerTask) {
    return Response.json(
      { error: "task_step_cap", taskId, message: "This task has run as far as it can. Start a new one with Bo." },
      { status: 429 }
    );
  }
  const turnSteps = Math.min(limits.maxStepsPerTurn, limits.maxStepsPerTask - stepsSoFar);

  const rejected = rejectedApprovals(body.messages);
  for (const r of rejected) {
    await addTaskEvent(user.id, taskId, "approval_rejected", { tool: r.tool ?? undefined, data: { toolCallId: r.toolCallId } });
  }
  // A "Change" tap hands the task back to Bo; it is no longer waiting on the user.
  if (rejected.length) await updateTask(user.id, taskId, { status: "planning" }).catch(() => {});

  const open: OpenServer[] = (await Promise.all(connected.map((c) => connectProvider(c.providerId, c.accessToken)))).flat();
  if (open.length === 0) {
    return Response.json(
      { error: "swiggy_connect_failed", message: "Couldn't reach Swiggy. Try again in a moment." },
      { status: 502 }
    );
  }

  let built: Awaited<ReturnType<typeof buildBoTools>>;
  try {
    built = await buildBoTools(open, { userId: user.id, taskId, approvalSecret: approvalSecret() });
  } catch (err) {
    await closeAll(open);
    console.error(`bo[${logId(user.id)}] tool discovery failed:`, err instanceof Error ? err.message.slice(0, 300) : err);
    return Response.json({ error: "tool_discovery_failed", message: "Couldn't load Swiggy's tools. Try again." }, { status: 502 });
  }

  let steps = 0;
  let toolCalls = 0;
  // Exactly once, from whichever way the turn ends (finish, closed tab, or a
  // stream error such as a forged approval): the spent steps still count.
  let finished = false;
  const finish = async () => {
    if (finished) return;
    finished = true;
    await recordTaskSteps(user.id, taskId, steps, toolCalls, limits.maxStepsPerTask);
    await closeAll(open);
  };
  const secret = approvalSecret();
  // The Swiggy service Bo is working in decides which tools a step sees
  // (lib/bo/swiggy-tools.ts activeToolNames): it carries over from earlier
  // turns and follows Bo's latest tool call within this one.
  let focus = built.serviceOf(lastToolName(body.messages) ?? "");
  let result;
  try {
    result = streamText({
      model: getServerModel(),
      instructions: boInstructions(foodProfile),
      messages: await boModelMessages(body.messages),
      tools: built.tools,
      toolChoice: "auto",
      activeTools: built.activeToolNames(focus),
      prepareStep: ({ steps }) => {
        for (const c of steps.at(-1)?.toolCalls ?? []) focus = built.serviceOf(c.toolName) ?? focus;
        return { activeTools: built.activeToolNames(focus) };
      },
      toolApproval: built.toolApproval,
      // Without a secret toolApproval denies every approval tool, so the SDK
      // never issues an approval that could not be verified.
      ...(secret ? { experimental_toolApprovalSecret: secret } : {}),
      stopWhen: isStepCount(turnSteps),
      onStepEnd: async (step) => {
        steps += 1;
        toolCalls += step.toolCalls.length;
        for (const c of step.toolCalls) {
          await addTaskEvent(user.id, taskId, "tool_call", { tool: c.toolName.replace(/^[a-z]+_/, "").replace("__", ".") });
        }
      },
      onError: async ({ error }) => {
        console.error(`bo[${logId(user.id)}] model stream failed:`, error instanceof Error ? error.message.slice(0, 300) : error);
        await finish();
      },
      onEnd: finish,
      onAbort: finish,
    });
  } catch (err) {
    await closeAll(open);
    console.error(`bo[${logId(user.id)}] model call failed:`, err instanceof Error ? err.message.slice(0, 300) : err);
    return Response.json({ error: "agent_failed", message: FAILED }, { status: 500 });
  }

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream, onError: () => FAILED }),
    headers: { "X-Bo-Task-Id": taskId, "X-Swiggy-Tools": String(built.count) },
  });
}
