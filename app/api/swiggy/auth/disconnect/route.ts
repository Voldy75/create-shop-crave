import { requireUser } from "@/lib/auth-guard";
import { getProvider } from "@/lib/mcp/registry";
import { getConnection, deleteConnection } from "@/lib/mcp/connections";
import { revokeToken } from "@/lib/mcp/oauth";

export const maxDuration = 10;

/** Revoke at the provider + delete the local row. */
export async function POST() {
  const guard = await requireUser();
  if (guard instanceof Response) return guard;
  const { user } = guard;

  const provider = await getProvider("swiggy");
  const existing = await getConnection(user.id, "swiggy");

  if (existing && provider) {
    await revokeToken(provider, existing.accessToken); // best-effort
  }
  // Delete regardless: a failed remote revoke must not leave a local row the
  // user believes they disconnected.
  await deleteConnection(user.id, "swiggy");
  return Response.json({ ok: true });
}
