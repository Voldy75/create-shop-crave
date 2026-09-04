import type { ReactNode } from "react";
import { MobileTabBar } from "@/components/mobile/MobileTabBar";

/**
 * Tabbed-screens layout — adds the bottom tab bar + matching bottom padding.
 * Wraps Home, Chat, Plan, Saved, Profile. Full-screen flows (onboarding,
 * paywall, buy/*) sit outside this group so they render edge-to-edge.
 *
 * The padding must clear the bar's full height (86px in meshi-b) plus the home
 * indicator, or the last card on every tab sits underneath it.
 */
export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ paddingBottom: "calc(86px + env(safe-area-inset-bottom, 0px))" }}>
      {children}
      <MobileTabBar />
    </div>
  );
}
