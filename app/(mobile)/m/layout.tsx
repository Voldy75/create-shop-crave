import type { ReactNode } from "react";
import { DM_Sans } from "next/font/google";
import NativeInit from "@/components/mobile/NativeInit";
import "./meshi.css";

/**
 * meshi mobile shell (bare) — black-first surface + DM Sans, max-width phone
 * column. NO tab bar here: full-screen flows like onboarding live directly
 * under /m, while tabbed screens nest under the (tabs) route group which adds
 * the bottom bar. The Capacitor native shell points server.url at /m.
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
        } as React.CSSProperties
      }
    >
      <NativeInit />
      {children}
    </div>
  );
}
