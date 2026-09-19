import { createServiceClient } from "@/lib/supabase/server";

/**
 * Append-only record of admin mutations.
 *
 * Every write under /api/admin/** should call this. Without it, "who banned
 * this user and why" is unanswerable, and retrofitting means the first N
 * moderation actions have no record.
 *
 * Deliberately best-effort: a failed audit write is logged loudly but does NOT
 * fail the mutation. The stricter "no audit, no action" rule is more defensible
 * in principle, but it means a transient DB hiccup blocks all admin work
 * including the ban you are trying to apply during an incident. Revisit if this
 * ever backs a compliance requirement -- at that point the right shape is to
 * write the audit row and the mutation in one transaction (a Postgres function),
 * not to bolt a throw onto this helper.
 *
 * The table has RLS enabled with zero policies, so it is service-role only:
 * nothing reaches it from the browser.
 */
export interface AuditEntry {
  actorUserId: string;
  /** dotted verb, e.g. "user.ban", "plan.update", "config.set" */
  action: string;
  targetType: "user" | "plan" | "plan_price" | "config" | "flag" | "mcp_provider" | "mcp_server";
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    const supabase = await createServiceClient();
    const { error } = await supabase.from("admin_audit_log").insert({
      actor_user_id: entry.actorUserId,
      action: entry.action,
      target_type: entry.targetType,
      target_id: entry.targetId ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
    });
    if (error) {
      console.error(
        `AUDIT WRITE FAILED action=${entry.action} target=${entry.targetType}:${entry.targetId} —`,
        error.message
      );
    }
  } catch (err) {
    console.error(`AUDIT WRITE FAILED action=${entry.action} —`, err);
  }
}
