import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-guard";
import { auditLog } from "@/lib/audit";
import { invalidateMcpCache } from "@/lib/mcp/registry";

function isValidHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** PUT upserts one mcp_provider_servers row keyed on (provider_id, service_key). */
export async function PUT(req: Request) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;
  const { user: actor } = guard;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { provider_id, service_key, label, url, tool_allowlist, enabled, sort } =
    body as Record<string, unknown>;

  if (typeof provider_id !== "string" || !provider_id) {
    return Response.json({ error: "provider_id (string) required" }, { status: 400 });
  }
  if (typeof service_key !== "string" || !service_key) {
    return Response.json({ error: "service_key (string) required" }, { status: 400 });
  }
  if (typeof url !== "string" || !isValidHttpsUrl(url)) {
    return Response.json({ error: "url must be a valid https URL" }, { status: 400 });
  }
  if (
    tool_allowlist !== undefined &&
    tool_allowlist !== null &&
    (!Array.isArray(tool_allowlist) || !tool_allowlist.every((t) => typeof t === "string"))
  ) {
    return Response.json(
      { error: "tool_allowlist must be an array of strings or null" },
      { status: 400 }
    );
  }

  const svc = await createServiceClient();

  const { data: before } = await svc
    .from("mcp_provider_servers")
    .select("*")
    .eq("provider_id", provider_id)
    .eq("service_key", service_key)
    .maybeSingle();

  const row: Record<string, unknown> = { provider_id, service_key, url };
  if (label !== undefined) row.label = label;
  if (tool_allowlist !== undefined) row.tool_allowlist = tool_allowlist;
  if (enabled !== undefined) row.enabled = enabled;
  if (sort !== undefined) row.sort = sort;

  const { data: after, error } = await svc
    .from("mcp_provider_servers")
    .upsert(row, { onConflict: "provider_id,service_key" })
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  await auditLog({
    actorUserId: actor.id,
    action: "mcp_server.upsert",
    targetType: "mcp_server",
    targetId: `${provider_id}:${service_key}`,
    before: before ?? null,
    after,
  });

  invalidateMcpCache();

  return Response.json({ server: after });
}

export async function DELETE(req: Request) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;
  const { user: actor } = guard;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { provider_id, service_key } = body as Record<string, unknown>;
  if (typeof provider_id !== "string" || !provider_id) {
    return Response.json({ error: "provider_id (string) required" }, { status: 400 });
  }
  if (typeof service_key !== "string" || !service_key) {
    return Response.json({ error: "service_key (string) required" }, { status: 400 });
  }

  const svc = await createServiceClient();

  const { data: before } = await svc
    .from("mcp_provider_servers")
    .select("*")
    .eq("provider_id", provider_id)
    .eq("service_key", service_key)
    .maybeSingle();

  const { error } = await svc
    .from("mcp_provider_servers")
    .delete()
    .eq("provider_id", provider_id)
    .eq("service_key", service_key);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  await auditLog({
    actorUserId: actor.id,
    action: "mcp_server.delete",
    targetType: "mcp_server",
    targetId: `${provider_id}:${service_key}`,
    before: before ?? null,
    after: null,
  });

  invalidateMcpCache();

  return Response.json({ ok: true });
}
