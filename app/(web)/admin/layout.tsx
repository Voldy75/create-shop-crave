import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { AdminDenied, AdminShell, type AdminEnv } from "./admin-shell";

/**
 * Admin gate. Signed out -> home. Signed in but not an admin -> w12i's
 * "This account isn't an admin" card (it used to redirect silently, which
 * left an admin on the wrong account no clue why the link "didn't work").
 * The nav is not rendered for a non-admin, and every /api/admin/** route
 * enforces requireAdmin on its own, so this page is presentation only.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const guard = await requireAdmin();
  const env: AdminEnv =
    process.env.VERCEL_ENV === "production" ? "production" : process.env.VERCEL_ENV === "preview" ? "preview" : "development";

  if (guard instanceof Response) {
    if (guard.status === 401) redirect("/");
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) redirect("/");
    return (
      <AdminShell env={env} email={data.user.email ?? null} denied>
        <AdminDenied email={data.user.email ?? null} />
      </AdminShell>
    );
  }

  return (
    <AdminShell env={env} email={guard.user.email ?? null}>
      {children}
    </AdminShell>
  );
}
