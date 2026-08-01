import type { ReactNode } from "react";
import { MobileTabBar } from "@/components/mobile/MobileTabBar";

/**
 * Tabbed-screens layout — adds the fixed bottom tab bar + bottom padding.
 * Wraps Home, Chat, Plan, Saved, Profile. Full-screen flows (onboarding) sit
 * outside this group so they render edge-to-edge without the bar.
 */
export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}>
      {children}
      <MobileTabBar />
    </div>
  );
}
