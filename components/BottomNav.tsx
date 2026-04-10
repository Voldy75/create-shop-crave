"use client";

import { usePathname, useRouter } from "next/navigation";
import { MessageCircle, Heart, Calendar } from "lucide-react";

const NAV_ITEMS = [
  { href: "/chat", icon: MessageCircle, label: "Chat" },
  { href: "/favorites", icon: Heart, label: "Saved" },
  { href: "/planner", icon: Calendar, label: "Planner" },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const showOnPaths = ["/chat", "/favorites", "/planner", "/arena", "/admin"];
  if (!showOnPaths.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
      style={{
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        paddingBottom: "env(safe-area-inset-bottom, 8px)",
        paddingTop: "8px",
        height: "49px",
      }}
      aria-label="Main navigation"
    >
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const isActive = pathname.startsWith(href);
        return (
          <button
            key={href}
            onClick={() => router.push(href)}
            className="flex flex-col items-center gap-0.5 px-6 py-1 transition-all min-h-[44px] min-w-[64px]"
            style={{ color: isActive ? "#ff6b35" : "rgba(255, 255, 255, 0.48)" }}
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon
              className="w-5 h-5"
              fill={isActive ? "currentColor" : "none"}
            />
            <span style={{
              fontSize: "10px",
              fontWeight: isActive ? 600 : 400,
              letterSpacing: "-0.01em",
            }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
