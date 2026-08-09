import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";

/**
 * Root layout #2 — the mobile tree (/m/*), which the Capacitor native shell
 * loads via server.url.
 *
 * Phase 10: this tree now runs entirely on the meshi Kitchef design system.
 *
 *   design/meshi-b.css     shared tokens + components (also used by web)
 *   app/(mobile)/m/mobile.css   mobile-only utilities meshi-b doesn't carry
 *
 * globals.css is deliberately NO LONGER imported here. It was kept through the
 * root-layout split purely to avoid a visual delta during that refactor; now
 * that the surface is re-skinned, its Tailwind base resets would only fight
 * the new system.
 *
 * What this deliberately does NOT render, versus web:
 *   - <BottomNav />  — allowlisted to web paths anyway; /m has its own tab bar.
 *   - <Toaster />    — nothing under /m uses sonner.
 */
import "../../design/meshi-b.css";
import "../../design/meshi-motion.css";
import "./m/mobile.css";
import { UserProvider } from "../context/UserContext";
import { ThemeProvider } from "../context/ThemeContext";

/**
 * Montserrat, self-hosted at build time by next/font. meshi-b.css expects it as
 * --m-font-display / --m-font-body; we bind the generated family onto both so
 * the stylesheet never has to reach for fonts.googleapis.com.
 */
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "meshi — Crave & Create",
  description:
    "Your personal AI food companion. Discover recipes or find the perfect restaurant based on your cravings.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "meshi",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Matches --m-cream so the iOS status bar and rubber-band overscroll blend
  // into the page instead of flashing white.
  themeColor: "#FBF6E3", // hex-ok: Next metadata, not CSS — cannot take a variable
};

export default function MobileRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // meshi is LIGHT-FIRST: :root is the cream palette and [data-theme="dark"]
    // is the secondary pass. This is the inverse of the old system.
    // suppressHydrationWarning is required, not cosmetic: the anti-flash script
    // below rewrites data-theme from localStorage BEFORE React hydrates, so the
    // server's "light" and the client's stored value legitimately differ. Without
    // this, React logs a hydration mismatch on every load for anyone whose theme
    // isn't the default.
    <html
      lang="en"
      className={montserrat.variable}
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('crave_theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body
        style={{
          margin: 0,
          fontFamily: "var(--m-font-body)",
          background: "var(--m-cream)",
          color: "var(--m-ink)",
        }}
      >
        {/* meshi is light-first; the shared provider defaults to dark for web. */}
        <ThemeProvider defaultTheme="light">
          <UserProvider>{children}</UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
