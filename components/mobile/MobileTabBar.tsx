"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home as HomeIcon, MessageCircle, CalendarDays, Bookmark, User } from "lucide-react";

/**
 * Bottom tab bar for the mobile (/m) experience. Fixed, safe-area aware,
 * glass background. Five primary destinations matching the Food-Kuu nav.
 */

const TABS = [
  { href: "/m", label: "Home", icon: HomeIcon, match: (p: string) => p === "/m" },
  { href: "/m/chat", label: "Chat", icon: MessageCircle, match: (p: string) => p.startsWith("/m/chat") },
  { href: "/m/plan", label: "Plan", icon: CalendarDays, match: (p: string) => p.startsWith("/m/plan") },
  { href: "/m/saved", label: "Saved", icon: Bookmark, match: (p: string) => p.startsWith("/m/saved") },
  { href: "/m/profile", label: "You", icon: User, match: (p: string) => p.startsWith("/m/profile") },
];

export function MobileTabBar() {
  const pathname = usePathname() ?? "/m";
  return (
    <nav
      className="fixed left-0 right-0 bottom-0 z-40"
      style={{
        background: "color-mix(in srgb, var(--cc-bg) 86%, transparent)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        borderTop: "1px solid var(--cc-border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex items-stretch justify-around" style={{ height: "56px", maxWidth: 520, margin: "0 auto" }}>
        {TABS.map((t) => {
          const active = t.match(pathname);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="flex flex-col items-center justify-center gap-1 flex-1 transition-opacity"
              style={{ color: active ? "var(--cc-accent)" : "var(--cc-text-tertiary)" }}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.4 : 1.8} />
              <span style={{ fontSize: "10px", fontWeight: active ? 700 : 500, letterSpacing: "0.01em" }}>
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
