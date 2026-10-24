import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — ignore
          }
        },
      },
    }
  );
}

/**
 * Service-role client — bypasses RLS. Server-only; never import from client code.
 *
 * MUST NOT carry the request's cookies. It used to be built with
 * @supabase/ssr's createServerClient and the user's cookie store; when the
 * request had a signed-in session, supabase-js sent THAT user's access token
 * as the Authorization header, so every "service" query silently ran as the
 * `authenticated` role instead of `service_role`. Found 2026-10-24 when the
 * first real Swiggy connect failed with "permission denied for table
 * mcp_connections" (a table `authenticated` deliberately cannot read). The
 * same fault hit every signed-in path that relies on this client: the admin
 * APIs, account deletion (auth.admin.deleteUser needs the service key),
 * audit logging, quotas and the MCP token store.
 *
 * A plain supabase-js client with the service key and no session handling is
 * the documented way to act as service_role.
 */
export async function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }
  );
}
