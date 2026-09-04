"use client";

import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ChefHat, ShoppingBag, CalendarDays, Swords, Settings } from "lucide-react";
import { BoBowl } from "@/components/mascots";
import { SidebarAccount } from "@/components/web/SidebarAccount";

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
 * Recipes / Groceries / Tracker. Discover still has no web route (it is
 * /m-only) so it is still not here — a nav item that goes nowhere is worse
 * than a shorter nav. Groceries JOINED when /cart was built for w4a; it was
 * absent for exactly that reason and no other. Recipes JOINED the same way
 * when /recipes was built for w9a — the slot used to read "Saved" pointing at
 * /favorites, which is now a redirect onto /recipes.
 *
 * Below the `--web-shell-bp` breakpoint the sidebar hides and
 * components/BottomNav.tsx remains the navigation, which is why that component
 * is still web-only rather than deleted.
 */

/** `exact` is no longer needed by any entry — /home replaced the "/" item, and
 *  every href here is a distinct top-level segment — but the flag is kept on the
 *  type so a future nested route can opt out of prefix matching. */
const NAV: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ width?: number; height?: number }>;
  exact?: boolean;
}> = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/recipes", label: "Recipes", icon: ChefHat },
  { href: "/cart", label: "Groceries", icon: ShoppingBag },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/arena", label: "Arena", icon: Swords },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
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

        <SidebarAccount />

      </aside>

      <div className="main web-main">{children}</div>
    </div>
  );
}
