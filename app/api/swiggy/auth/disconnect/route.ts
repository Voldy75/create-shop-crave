import { createClient } from "@/lib/supabase/server";
import { clearToken, getStoredToken } from "@/lib/swiggy-mcp";
import { revokeToken } from "@/lib/swiggy-oauth";

export const maxDuration = 10;

/** Revoke at Swiggy + delete the local row. */
export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await getStoredToken(user.id);
  if (existing) {
    await revokeToken(existing.accessToken); // best-effort
  }
  await clearToken(user.id);
  return Response.json({ ok: true });
}
