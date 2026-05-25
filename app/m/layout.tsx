import type { ReactNode } from "react";
import { Fraunces, Inter } from "next/font/google";
import { MobileTabBar } from "@/components/mobile/MobileTabBar";
import "./foodkuu.css";

/**
 * Food-Kuu mobile shell. Warm cream surface, Fraunces serif display + Inter
 * sans, fixed bottom tab bar. The Capacitor native shell points server.url at
 * /m, so this subtree IS the app. Existing web routes stay untouched.
 *
 * next/font wires the two families to the CSS vars foodkuu.css references
 * (--fk-display / --fk-sans).
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--fk-display-font",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--fk-sans-font",
  display: "swap",
});

export default function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`fk-screen ${fraunces.variable} ${inter.variable}`}
      style={
        {
          // bind next/font vars to the names foodkuu.css expects
          ["--fk-display" as string]: "var(--fk-display-font), Georgia, serif",
          ["--fk-sans" as string]: "var(--fk-sans-font), -apple-system, system-ui, sans-serif",
          minHeight: "100dvh",
          background: "var(--fk-bg)",
          color: "var(--fk-ink)",
          maxWidth: 520,
          margin: "0 auto",
          paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
        } as React.CSSProperties
      }
    >
      {children}
      <MobileTabBar />
    </div>
  );
}
