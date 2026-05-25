import type { ReactNode } from "react";
import { DM_Sans } from "next/font/google";
import { MobileTabBar } from "@/components/mobile/MobileTabBar";
import "./meshi.css";

/**
 * meshi mobile shell — black-first Apple-style. DM Sans stands in for Google
 * Sans (the design's preferred face, not freely licensable). The Capacitor
 * native shell points server.url at /m, so this subtree IS the app; the
 * existing web routes stay untouched for the browser/PWA.
 */
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--cc-sans-font",
  display: "swap",
});

export default function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`cc ${dmSans.variable}`}
      style={
        {
          ["--cc-sans" as string]: "var(--cc-sans-font)",
          minHeight: "100dvh",
          background: "var(--cc-bg)",
          color: "var(--cc-ink-1)",
          maxWidth: 520,
          margin: "0 auto",
          paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))",
        } as React.CSSProperties
      }
    >
      {children}
      <MobileTabBar />
    </div>
  );
}
