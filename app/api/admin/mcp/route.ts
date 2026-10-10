import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-guard";
import { auditLog } from "@/lib/audit";
import { listProviders, listServers, clientIdFor, invalidateMcpCache } from "@/lib/mcp/registry";

const AUTH_TYPES = ["oauth_pkce", "api_key", "none"] as const;

/**
 * Admin view of the MCP provider registry: every provider (including
 * disabled), its servers nested, and per-provider health. Mirrors
 * app/api/admin/config/route.ts's "presence only, never the value" rule for
 * the client-id env var.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  const svc = await createServiceClient();

  const [providers, servers, connCounts] = await Promise.all([
    listProviders({ fresh: true }),
    listServers({ fresh: true }),
    svc.from("mcp_connections").select("provider_id"),
  ]);

  if (connCounts.error) {
    return Response.json({ error: connCounts.error.message }, { status: 500 });
  }

  // One batched grouped query: count rows per provider_id client-side rather
  // than issuing a COUNT per provider.
  const countByProvider = new Map<string, number>();
  for (const row of connCounts.data ?? []) {
    const id = (row as { provider_id: string }).provider_id;
    countByProvider.set(id, (countByProvider.get(id) ?? 0) + 1);
  }

  const result = providers.map((p) => ({
    ...p,
    servers: servers.filter((s) => s.providerId === p.id),
    clientIdPresent: !!clientIdFor(p),
    clientIdEnv: p.clientIdEnv,
    connectionCount: countByProvider.get(p.id) ?? 0,
  }));

  return Response.json({ providers: result });
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;
  const { user: actor } = guard;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof (body as { id?: unknown }).id !== "string") {
    return Response.json({ error: "id (string) required" }, { status: 400 });
  }

  const providerId = (body as { id: string }).id;

  const {
    enabled,
    name,
    auth_type,
    authorize_base,
    authorize_path,
    token_path,
    revoke_path,
    scopes,
    client_id_env,
    notes,
    sort,
  } = body as Record<string, unknown>;
  const id = providerId;

  if (auth_type !== undefined && !AUTH_TYPES.includes(auth_type as (typeof AUTH_TYPES)[number])) {
    return Response.json(
      { error: `auth_type must be one of ${AUTH_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (enabled !== undefined) patch.enabled = enabled;
  if (name !== undefined) patch.name = name;
  if (auth_type !== undefined) patch.auth_type = auth_type;
  if (authorize_base !== undefined) patch.authorize_base = authorize_base;
  if (authorize_path !== undefined) patch.authorize_path = authorize_path;
  if (token_path !== undefined) patch.token_path = token_path;
  if (revoke_path !== undefined) patch.revoke_path = revoke_path;
  if (scopes !== undefined) patch.scopes = scopes;
  if (client_id_env !== undefined) patch.client_id_env = client_id_env;
  if (notes !== undefined) patch.notes = notes;
  if (sort !== undefined) patch.sort = sort;

  const svc = await createServiceClient();

  const { data: before, error: beforeError } = await svc
    .from("mcp_providers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (beforeError) {
    return Response.json({ error: beforeError.message }, { status: 500 });
  }
  if (!before) {
    return Response.json({ error: "Unknown provider" }, { status: 404 });
  }

  const { data: after, error } = await svc
    .from("mcp_providers")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  await auditLog({
    actorUserId: actor.id,
    action: "mcp_provider.update",
    targetType: "mcp_provider",
    targetId: id,
    before,
    after,
  });

  invalidateMcpCache();

  return Response.json({ provider: after });
}
