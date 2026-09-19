"use client";

/**
 * SidebarAccount — the sidebar's account block, now a real menu.
 *
 * It used to be a STATIC avatar/name/email display. Two consequences, both
 * flagged in `app/(web)/(app)/chat/page.tsx`'s header comment when the w3a
 * topbar replaced the old avatar dropdown and neither was fixed at the time:
 *
 *  1. **Theme could not be changed at all once signed in.**
 *     components/ThemeToggle.tsx is rendered ONLY on the pre-auth landing nav
 *     (app/(web)/page.tsx). A signed-in user had no way to reach light/dark —
 *     which matters more now the dark palette is actually being reviewed.
 *  2. **Sign out took an extra hop** through Settings → Account.
 *
 * Both live here now. This is the one place in the signed-in web app that owns
 * "things about me", so a future avatar upload or plan badge belongs here too.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Moon, Settings as SettingsIcon, Sun } from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import { useTheme } from "@/app/context/ThemeContext";

export function SidebarAccount() {
  const { user, userName, hydrated, signOut } = useUser();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Guard on `hydrated`: UserContext fills in after mount, so without this the
  // block renders "Guest / Not signed in" for a frame before the real identity
  // arrives — a visible flash of being logged out.
  const name = hydrated ? userName || user?.email?.split("@")[0] || "Guest" : "Guest";
  const initials = hydrated
    ? (userName || user?.email || "")
        .split(/[\s@._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("") || "\u00b7\u00b7"
    : "\u00b7\u00b7";

  // Close on outside click and on Escape. Without the Escape branch the menu is
  // a keyboard trap — you can open it with the keyboard and not dismiss it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    router.replace("/");
  };

  return (
    <div className="acct-wrap" ref={wrapRef}>
      {open && (
        <div className="acct-menu" role="menu" aria-label="Account">
          {/* Theme first: it is the reason this menu exists, and the only place
              a signed-in user can reach it. */}
          <button className="acct-item" role="menuitem" onClick={toggleTheme}>
            {theme === "dark" ? <Sun width={16} height={16} aria-hidden /> : <Moon width={16} height={16} aria-hidden />}
            <span className="grow">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>

          <Link href="/settings" className="acct-item" role="menuitem" onClick={() => setOpen(false)}>
            <SettingsIcon width={16} height={16} aria-hidden />
            <span className="grow">Settings</span>
          </Link>

          {user && (
            <>
              <i className="acct-sep" aria-hidden />
              <button className="acct-item acct-item-danger" role="menuitem" onClick={handleSignOut}>
                <LogOut width={16} height={16} aria-hidden />
                <span className="grow">Sign out</span>
              </button>
            </>
          )}
        </div>
      )}

      <button
        className="side-acct acct-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <span className="side-avatar side-avatar-initials">{initials}</span>
        <span className="vstack grow" style={{ gap: 0, minWidth: 0, textAlign: "left" }}>
          <span className="t-h2" style={{ fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {name}
          </span>
          <span className="t-cap" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {user?.email ?? "Not signed in"}
          </span>
        </span>
      </button>
    </div>
  );
}
