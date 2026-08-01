import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";

/**
 * Root layout #2 — the mobile tree (/m/*), which the Capacitor native shell
 * loads via server.url.
 *
 * Separate from app/(web)/layout.tsx so the two surfaces own their own <html>,
 * fonts, and chrome. What this deliberately does NOT render, versus web:
 *   - <BottomNav />  — already allowlisted to web paths only, so omitting it is
 *                      behaviour-preserving; /m has its own tab bar in
 *                      app/(mobile)/m/(tabs)/layout.tsx.
 *   - <Toaster />    — nothing under /m uses sonner.
 *
 * globals.css is still imported here ON PURPOSE. /m inherited it from the old
 * shared root layout, so its base resets (focus-visible outline, scrollbar
 * styling, border defaults) are baked into how every mobile screen renders
 * today. Dropping it in this phase would cause exactly the visual delta this
 * phase exists to avoid. Phase 10 removes it when meshi.css is replaced
 * wholesale by design/meshi-b.css — that is the right moment, because both
 * files change together.
 *
 * The DM Sans font and the .cc token wrapper stay in app/(mobile)/m/layout.tsx,
 * untouched.
 */
import "../globals.css";
import { UserProvider } from "../context/UserContext";
import { ThemeProvider } from "../context/ThemeContext";

export const metadata: Metadata = {
  title: "meshi — Crave & Create",
  description:
    "Your personal AI food companion. Discover recipes or find the perfect restaurant based on your cravings.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "meshi",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function MobileRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={GeistSans.variable} data-theme="dark">
      <head>
        {/* Anti-flash: sets data-theme before React hydrates. Kept in sync with
            the web root layout. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('crave_theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={GeistSans.className}>
        <ThemeProvider>
          <UserProvider>{children}</UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
