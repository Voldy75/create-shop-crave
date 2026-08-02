import type { ReactNode } from "react";
import { AppShell } from "@/components/web/AppShell";

/**
 * Signed-in app routes — everything that should carry the persistent sidebar
 * from artboard w2a.
 *
 * `(app)` is a ROUTE GROUP: it adds no URL segment, so /chat, /planner,
 * /favorites, /arena and /settings keep their exact paths. This is the same
 * device that gives the repo its (web) / (mobile) split.
 *
 * Deliberately NOT in here:
 *   app/(web)/page.tsx  — the marketing landing has its own full-bleed
 *                         treatment and no app chrome.
 *   app/(web)/admin/*   — already has its own layout and nav.
 */
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
