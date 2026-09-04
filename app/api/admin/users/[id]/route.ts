import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-guard";
import { auditLog } from "@/lib/audit";
import { invalidateLimitsCache } from "@/lib/limits";

const VALID_STATUSES = ["active", "restricted", "banned"] as const;
const VALID_ROLES = ["user", "support", "admin"] as const;

type Status = (typeof VALID_STATUSES)[number];
type Role = (typeof VALID_ROLES)[number];

interface PatchBody {
  status?: Status;
  status_reason?: string;
  role?: Role;
  plan_id?: string | null;
}

interface UserProfileRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: Role;
  status: Status;
  status_reason: string | null;
  status_changed_at: string | null;
  status_changed_by: string | null;
  plan_id: string | null;
  first_seen_platform: string | null;
  last_seen_platform: string | null;
  last_seen_at: string | null;
  created_at: string;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;
  const { user: actor } = guard;

  const { id } = await params;
  if (!id) {
    return Response.json({ error: "Missing user id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");
  const hasRole = Object.prototype.hasOwnProperty.call(body, "role");
  const hasPlan = Object.prototype.hasOwnProperty.call(body, "plan_id");

  if (hasStatus && !VALID_STATUSES.includes(body.status as Status)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }
  if (hasRole && !VALID_ROLES.includes(body.role as Role)) {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }
  if (hasPlan && body.plan_id !== null && typeof body.plan_id !== "string") {
    return Response.json({ error: "Invalid plan_id" }, { status: 400 });
  }

  if (hasStatus && body.status !== "active") {
    if (!body.status_reason || typeof body.status_reason !== "string" || !body.status_reason.trim()) {
      return Response.json(
        { error: "status_reason is required when status is not active" },
        { status: 400 }
      );
    }
  }

  // Self-lockout guard: an admin cannot ban/restrict themselves, nor demote
  // their own role away from admin. This is the only protection against
  // locking yourself out of the console.
  if (id === actor.id) {
    if (hasStatus && body.status !== "active") {
      return Response.json(
        { error: "You cannot change your own account status" },
        { status: 400 }
      );
    }
    if (hasRole && body.role !== "admin") {
      return Response.json(
        { error: "You cannot demote your own admin role" },
        { status: 400 }
      );
    }
  }

  const svc = await createServiceClient();

  const { data: before, error: beforeError } = await svc
    .from("user_profiles")
    .select(
      "user_id, email, display_name, role, status, status_reason, status_changed_at, status_changed_by, plan_id, first_seen_platform, last_seen_platform, last_seen_at, created_at"
    )
    .eq("user_id", id)
    .maybeSingle<UserProfileRow>();

  if (beforeError) {
    return Response.json({ error: beforeError.message }, { status: 500 });
  }
  if (!before) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  // If plan_id references a plan, validate it exists.
  if (hasPlan && body.plan_id !== null) {
    const { data: planRow, error: planError } = await svc
      .from("plans")
      .select("id")
      .eq("id", body.plan_id as string)
      .maybeSingle();
    if (planError) {
      return Response.json({ error: planError.message }, { status: 500 });
    }
    if (!planRow) {
      return Response.json({ error: "Unknown plan_id" }, { status: 400 });
    }
  }

  const updates: Record<string, unknown> = {};
  if (hasStatus) {
    updates.status = body.status;
    updates.status_reason = body.status === "active" ? body.status_reason ?? null : body.status_reason;
    updates.status_changed_at = new Date().toISOString();
    updates.status_changed_by = actor.id;
  }
  if (hasRole) {
    updates.role = body.role;
  }
  if (hasPlan) {
    updates.plan_id = body.plan_id;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data: after, error: updateError } = await svc
    .from("user_profiles")
    .update(updates)
    .eq("user_id", id)
    .select(
      "user_id, email, display_name, role, status, status_reason, status_changed_at, status_changed_by, plan_id, first_seen_platform, last_seen_platform, last_seen_at, created_at"
    )
    .single<UserProfileRow>();

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  // One audit row per field that actually changed.
  const auditPromises: Promise<void>[] = [];
  if (hasStatus && before.status !== after.status) {
    auditPromises.push(
      auditLog({
        actorUserId: actor.id,
        action: "user.status_change",
        targetType: "user",
        targetId: id,
        before: { status: before.status, status_reason: before.status_reason },
        after: { status: after.status, status_reason: after.status_reason },
      })
    );
  }
  if (hasRole && before.role !== after.role) {
    auditPromises.push(
      auditLog({
        actorUserId: actor.id,
        action: "user.role_change",
        targetType: "user",
        targetId: id,
        before: { role: before.role },
        after: { role: after.role },
      })
    );
  }
  if (hasPlan && before.plan_id !== after.plan_id) {
    auditPromises.push(
      auditLog({
        actorUserId: actor.id,
        action: "user.plan_change",
        targetType: "user",
        targetId: id,
        before: { plan_id: before.plan_id },
        after: { plan_id: after.plan_id },
      })
    );
  }
  await Promise.all(auditPromises);

  if ((hasPlan && before.plan_id !== after.plan_id) || (hasStatus && before.status !== after.status)) {
    invalidateLimitsCache();
  }

  return Response.json({ user: after });
}
