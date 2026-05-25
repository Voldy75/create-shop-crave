"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, CalendarDays, Heart, User } from "lucide-react";

/**
 * Food-Kuu bottom tab bar (.fk-tabbar / .fk-tab). Five destinations matching
 * the handoff: Home, Chat, Plan, Saved, Me. Saffron active state.
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
    <nav className="fk-tabbar">
      {TABS.map((t) => {
        const active = t.match(pathname);
        const Icon = t.icon;
        return (
          <Link key={t.href} href={t.href} className={`fk-tab ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
            <span style={{ display: "grid", placeItems: "center" }}>
              <Icon width={22} height={22} strokeWidth={active ? 2.4 : 1.8} />
            </span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
