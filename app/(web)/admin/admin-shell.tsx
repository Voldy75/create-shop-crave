"use client";

/**
 * WF12 admin chrome: the forest side nav + the per-page top bar.
 *
 * The board's environment pill reads PRODUCTION on every screen. Here it comes
 * from VERCEL_ENV (passed down by the server layout), so a preview deploy or a
 * local dev server says so instead of claiming to be production.
 */

import { createContext, useContext } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, Coins, Flag, Lock, Plug, Settings, Users } from "lucide-react";
import { BoBowl } from "@/components/mascots";
import { useUser } from "@/app/context/UserContext";

export type AdminEnv = "production" | "preview" | "development";

const EnvContext = createContext<AdminEnv>("development");

const NAV = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/plans", label: "Plans", icon: Coins },
  { href: "/admin/flags", label: "Flags", icon: Flag },
  { href: "/admin/mcp", label: "MCP providers", icon: Plug },
  { href: "/admin/config", label: "Config", icon: Settings },
];

const initials = (email: string | null) => {
  const parts = (email ?? "?").split(/[@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
};

export function AdminShell({
  env,
  email,
  denied = false,
  children,
}: {
  env: AdminEnv;
  email: string | null;
  denied?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <EnvContext.Provider value={env}>
      <div className="adm">
        <nav className="ad-side" aria-label="Admin">
          <div className="ad-brand">
            <BoBowl width={26} height={26} aria-hidden />
            <span>meshi</span>
            <span className="ad-pill">ADMIN</span>
          </div>
          {!denied &&
            NAV.map(({ href, label, icon: Icon }) => {
              const on = href === "/admin" ? pathname === "/admin" : pathname?.startsWith(href);
              return (
                <Link key={href} href={href} className={`ad-nav${on ? " is-on" : ""}`} aria-current={on ? "page" : undefined}>
                  <Icon width={16} height={16} aria-hidden />
                  {label}
                </Link>
              );
            })}
          <div className="grow" />
          <Link href="/chat" className="ad-nav">
            <ArrowLeft width={15} height={15} aria-hidden />
            Back to app
          </Link>
          {email && (
            <div className="ad-acct">
              <span className="ad-av" aria-hidden>{initials(email)}</span>
              <span className="ad-em" title={email}>{email}</span>
            </div>
          )}
        </nav>
        <div className="ad-main">{children}</div>
      </div>
    </EnvContext.Provider>
  );
}

const ENV_PILL: Record<AdminEnv, { label: string; cls: string }> = {
  production: { label: "PRODUCTION", cls: "ad-warn" },
  preview: { label: "PREVIEW", cls: "ad-mute" },
  development: { label: "LOCAL", cls: "ad-mute" },
};

/** The top bar every admin screen starts with: title, env pill, actions. */
export function AdminTop({ title, children }: { title: string; children?: React.ReactNode }) {
  const env = ENV_PILL[useContext(EnvContext)];
  return (
    <header className="ad-top">
      <h1 className="ad-title">{title}</h1>
      <span className={`ad-pill ad-env ${env.cls}`}>{env.label}</span>
      <div className="grow" />
      {children}
    </header>
  );
}

/** w12g's top-bar loading indicator. */
export function AdminLoading() {
  return (
    <span className="hstack" style={{ gap: 7 }} role="status">
      <span className="dlsp" style={{ width: 13, height: 13, borderWidth: 2 }} aria-hidden />
      <span className="ad-cap">Loading…</span>
    </span>
  );
}

/** Error banner shared by every admin screen. */
export function AdminError({ children }: { children: React.ReactNode }) {
  return (
    <div className="ad-notice is-bad" role="alert">
      {children}
    </div>
  );
}

/** w12i — signed in, but not an admin. */
export function AdminDenied({ email }: { email: string | null }) {
  const router = useRouter();
  const { signOut } = useUser();
  return (
    <>
      <AdminTop title="Admin" />
      <div className="ad-body" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="ad-card" style={{ width: 440, maxWidth: "100%", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 12, boxSizing: "border-box" }}>
          <div className="hstack" style={{ gap: 11 }}>
            <span className="ad-bad" style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }} aria-hidden>
              <Lock width={17} height={17} />
            </span>
            <span style={{ font: "800 17px var(--m-font-display)", color: "var(--m-ink)" }}>This account isn’t an admin</span>
          </div>
          <span style={{ font: "500 13px/1.5 var(--m-font-body)", color: "var(--m-ink-soft)" }}>
            You’re signed in as <b style={{ color: "var(--m-ink)" }}>{email ?? "this account"}</b>. The admin console is only
            available to accounts an existing admin has made an admin.
          </span>
          <div className="hstack" style={{ gap: 8, paddingTop: 4, flexWrap: "wrap" }}>
            <Link href="/chat" className="ad-btn ad-btn-p">
              Back to meshi
            </Link>
            <button
              type="button"
              className="ad-btn"
              onClick={async () => {
                await signOut();
                router.replace("/");
              }}
            >
              Sign in with another account
            </button>
          </div>
          <span className="ad-mono" style={{ fontSize: 11, color: "var(--m-ink-soft)" }}>403 · admin role required</span>
        </div>
      </div>
    </>
  );
}
