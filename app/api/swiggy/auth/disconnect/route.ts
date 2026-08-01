import { requireUser } from "@/lib/auth-guard";
import { clearToken, getStoredToken } from "@/lib/swiggy-mcp";
import { revokeToken } from "@/lib/swiggy-oauth";

export const maxDuration = 10;

/** Revoke at Swiggy + delete the local row. */
export async function POST() {
  const guard = await requireUser();
  if (guard instanceof Response) return guard;
  const { user } = guard;

  const existing = await getStoredToken(user.id);
  if (existing) {
    await revokeToken(existing.accessToken); // best-effort
  }
  await clearToken(user.id);
  return Response.json({ ok: true });
}
