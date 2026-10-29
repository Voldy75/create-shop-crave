import { after } from "next/server";
import { requireBoUser } from "@/lib/bo/guard";
import { getTask } from "@/lib/bo/tasks";
import { watchPayment, type PaymentWatch } from "@/lib/bo/follow";
import { callbackUrlFor } from "@/lib/mcp/oauth";

// Long enough to resume a payment watch after the response (lib/bo/follow.ts).
export const maxDuration = 300;
const WATCH_BUDGET_MS = (maxDuration - 20) * 1000;

const TASK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Where one of the user's Bo tasks stands — what the chat's status strip
 * polls while a UPI payment is pending. Returns the status and the payment
 * outcome only (no Swiggy ids). If a payment is pending and no watcher holds
 * it (the turn's own watcher ran out of time), this resumes the watch after
 * responding, so the order is still confirmed when the user comes back.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireBoUser();
  if (guard instanceof Response) return guard;
  const { user } = guard;
  const { id } = await params;
  if (!TASK_ID.test(id)) return Response.json({ error: "invalid_task" }, { status: 400 });

  const startedAt = Date.now();
  const task = await getTask(user.id, id).catch(() => null);
  if (!task) return Response.json({ error: "task_not_found" }, { status: 404 });

  const w = (task.plan?.payment ?? null) as PaymentWatch | null;
  const watching = !!w && !w.result && !!w.leaseUntil && Date.parse(w.leaseUntil) > Date.now();
  if (w && !w.result && !watching) {
    after(() => watchPayment(user.id, id, startedAt + WATCH_BUDGET_MS, (p) => callbackUrlFor(req, p)));
  }

  return Response.json(
    {
      status: task.status,
      mode: task.mode,
      payment: w ? { result: w.result ?? "pending", amount: w.amount ?? null, startedAt: w.startedAt, endedAt: w.endedAt ?? null } : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
