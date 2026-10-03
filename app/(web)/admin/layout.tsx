import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/auth-guard";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdminUser())) {
    redirect("/");
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--m-cream)" }}>
      <AdminNav />
      {children}
    </div>
  );
}
