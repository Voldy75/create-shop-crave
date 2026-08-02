"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Heart, CalendarDays, Swords, Settings } from "lucide-react";
import { BoBowl } from "@/components/mascots";
import { useUser } from "@/app/context/UserContext";

/**
 * Web app shell — the 250px sidebar from artboard w2a.
 *
 * This is the RESTRUCTURE the plan called for rather than a re-skin: the web
 * app had no persistent navigation at all on desktop, only a per-page sticky
 * header with a back arrow, which is a phone pattern wearing a desktop
 * viewport.
 *
 * Deliberately partial, and it is worth being precise about why. The artboard
 * also has a 74px topbar and a 336px "Today" rail. Both are landing with the
 * per-screen conversions, because the topbar REPLACES each page's own sticky
 * header — shipping it now would just stack two headers on every screen. The
 * sidebar has no such conflict, so it can land first and every route benefits
 * immediately.
 *
 * NAV IS REAL ROUTES ONLY. The artboard's sidebar reads Home / Discover /
 * Recipes / Groceries / Tracker; Discover and Groceries have no web route at
 * all (they are /m-only), so they are not here. A nav item that goes nowhere
 * is worse than a shorter nav.
 *
 * Below the `--web-shell-bp` breakpoint the sidebar hides and
 * components/BottomNav.tsx remains the navigation, which is why that component
 * is still web-only rather than deleted.
 */

const NAV = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/favorites", label: "Saved", icon: Heart },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/arena", label: "Arena", icon: Swords },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { user, userName, hydrated } = useUser();

  const name = hydrated && userName ? userName : "Guest";
  const initials = hydrated && userName ? userName.slice(0, 2).toUpperCase() : "··";
  const boActive = pathname.startsWith("/chat");

  return (
    <div className="web-shell">
      {/* Not "Main navigation" — BottomNav already claims that label, and the
          two are alternates for the same job at different widths. */}
      <aside className="side" aria-label="Sidebar">
        <div className="side-logo">
          <BoBowl width={40} height={40} />
          meshi
        </div>

        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`snav ${active ? "snav-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon width={22} height={22} />
              {label}
            </Link>
          );
        })}

        {/* Bo is the primary action here exactly as he is on the mobile tab
            bar — same affordance, same chunky press. */}
        <Link
          href="/chat"
          className="side-bo"
          aria-current={boActive ? "page" : undefined}
        >
          <span className="bo-orb">
            <BoBowl width={27} height={27} />
          </span>
          Ask Bo
        </Link>

        <div className="side-acct">
          <span className="side-avatar side-avatar-initials">{initials}</span>
          <div className="vstack grow" style={{ gap: 0, minWidth: 0 }}>
            <span className="t-h2" style={{ fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {name}
            </span>
            <span className="t-cap" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.email ?? "Not signed in"}
            </span>
          </div>
        </div>
      </aside>

      <div className="main web-main">{children}</div>
    </div>
  );
}
