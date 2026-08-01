"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, Heart, User } from "lucide-react";
import { BoBowl } from "@/components/mascots";

/**
 * meshi bottom tab bar.
 *
 * Bo sits in the centre as a RAISED circular action, per the design's
 * `.tab-bo` / `.tab-bo-btn`. Bo is the brand's AI presence, so chat is no
 * longer a peer tab — it is the primary affordance on the bar.
 *
 * Uses meshi-b's `.tab-active` (the previous stylesheet used `.on`, which
 * matches nothing in the new system) and the `.tab-ic` pill that fills with
 * --m-tint-green when active.
 */
const LEFT = [
  { href: "/m", label: "Home", icon: Home, match: (p: string) => p === "/m" },
  { href: "/m/plan", label: "Plan", icon: CalendarDays, match: (p: string) => p.startsWith("/m/plan") },
];

const RIGHT = [
  { href: "/m/saved", label: "Saved", icon: Heart, match: (p: string) => p.startsWith("/m/saved") },
  { href: "/m/profile", label: "Me", icon: User, match: (p: string) => p.startsWith("/m/profile") },
];

export function MobileTabBar() {
  const pathname = usePathname() ?? "/m";
  const chatActive = pathname.startsWith("/m/chat");

  const renderTab = (t: (typeof LEFT)[number]) => {
    const active = t.match(pathname);
    const Icon = t.icon;
    return (
      <Link
        key={t.href}
        href={t.href}
        className={`tab ${active ? "tab-active" : ""}`}
        aria-current={active ? "page" : undefined}
      >
        <span className="tab-ic">
          <Icon width={21} height={21} strokeWidth={active ? 2.4 : 1.8} />
        </span>
        {t.label}
      </Link>
    );
  };

  return (
    <nav className="tabbar">
      {LEFT.map(renderTab)}

      <Link
        href="/m/chat"
        className="tab tab-bo"
        aria-label="Ask Bo"
        aria-current={chatActive ? "page" : undefined}
      >
        <span className="tab-bo-btn">
          <BoBowl width={34} height={34} />
        </span>
        Bo
      </Link>

      {RIGHT.map(renderTab)}
    </nav>
  );
}
