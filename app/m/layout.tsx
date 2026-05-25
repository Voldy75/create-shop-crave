import type { ReactNode } from "react";
import { MobileTabBar } from "@/components/mobile/MobileTabBar";

/**
 * Mobile shell layout. Everything under /m renders inside a phone-framed,
 * dark-by-default surface with a fixed bottom tab bar. The Capacitor native
 * shell points server.url at this subtree (.../m), so these routes ARE the app.
 *
 * The existing web routes (/chat, /planner, …) are untouched and continue to
 * serve the browser/PWA experience.
 */
export default function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="cc"
      style={{
        minHeight: "100dvh",
        background: "var(--cc-bg)",
        color: "var(--cc-text-primary)",
        // leave room for the fixed tab bar + safe area
        paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))",
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      {children}
      <MobileTabBar />
    </div>
  );
}
