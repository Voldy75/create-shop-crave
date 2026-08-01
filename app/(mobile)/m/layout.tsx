import type { ReactNode } from "react";
import NativeInit from "@/components/mobile/NativeInit";

/**
 * meshi mobile shell — cream surface, max-width phone column.
 *
 * NO tab bar here: full-screen flows (onboarding, paywall, buy/*) live directly
 * under /m, while tabbed screens nest under the (tabs) route group which adds
 * the bottom bar. Moving a file between the two changes its chrome.
 *
 * The old `.cc` wrapper is gone. It scoped the previous stylesheet
 * (`.cc .card`, `.cc .chip`, …) and its remaining job was to out-specify the
 * web tokens bleeding in from globals.css. Now that this tree loads
 * design/meshi-b.css on its own, the scope is unnecessary — and keeping it
 * would have meant every meshi-b class needed a `.cc` ancestor to match.
 *
 * DM Sans is gone too; Montserrat is bound once in the root layout.
 */
export default function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--m-cream)",
        color: "var(--m-ink)",
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      <NativeInit />
      {children}
    </div>
  );
}
