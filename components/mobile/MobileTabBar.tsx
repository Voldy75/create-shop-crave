"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, CalendarDays, Heart, User } from "lucide-react";

/**
 * meshi bottom tab bar (.tabbar.glass / .tab.on). Five destinations:
 * Home, Chat, Plan, Saved, Me. Saffron active state.
 */
const TABS = [
  { href: "/m", label: "Home", icon: Home, match: (p: string) => p === "/m" },
  { href: "/m/chat", label: "Chat", icon: MessageCircle, match: (p: string) => p.startsWith("/m/chat") },
  { href: "/m/plan", label: "Plan", icon: CalendarDays, match: (p: string) => p.startsWith("/m/plan") },
  { href: "/m/saved", label: "Saved", icon: Heart, match: (p: string) => p.startsWith("/m/saved") },
  { href: "/m/profile", label: "Me", icon: User, match: (p: string) => p.startsWith("/m/profile") },
];

export function MobileTabBar() {
  const pathname = usePathname() ?? "/m";
  return (
    <nav className="tabbar glass">
      {TABS.map((t) => {
        const active = t.match(pathname);
        const Icon = t.icon;
        return (
          <Link key={t.href} href={t.href} className={`tab ${active ? "on" : ""}`} aria-current={active ? "page" : undefined}>
            <Icon width={22} height={22} strokeWidth={active ? 2.4 : 1.8} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
