"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/config", label: "Config" },
  { href: "/admin/flags", label: "Flags" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <header className="glass-nav sticky top-0 z-20 px-6" style={{ height: "48px" }}>
      <nav className="h-full flex items-center gap-1 max-w-5xl mx-auto">
        {TABS.map((tab) => {
          const active =
            tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "px-3 py-1.5 rounded-[var(--cc-radius-pill)] text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--cc-accent-dim)] text-[var(--cc-accent)]"
                  : "text-[var(--cc-text-secondary)] hover:bg-[var(--cc-surface-2)] hover:text-[var(--cc-text-primary)]"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
