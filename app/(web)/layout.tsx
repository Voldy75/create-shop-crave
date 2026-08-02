import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";

/**
 * Root layout #1 — the web tree.
 *
 * Phase 10c: this tree now runs on meshi Kitchef, like /m does.
 *
 *   design/meshi-b.css    shared tokens + components (also used by mobile)
 *   design/meshi-web.css  desktop shell layer — sidebar / topbar / rail
 *   app/globals.css       Tailwind + the --cc-* aliases onto --m-*
 *
 * IMPORT ORDER MATTERS. globals.css comes last so its `@layer` rules stay
 * beneath meshi-b's unlayered ones — an unlayered rule outranks any layered
 * one regardless of source order, and that is the direction we want: where the
 * two systems name the same class, the new system wins.
 *
 * General Sans and Geist are gone. meshi is one family, Montserrat, and the
 * old --font-display / GeistSans variables were only ever consumed by
 * Midnight Kitchen rules.
 */
import "../../design/meshi-b.css";
import "../../design/meshi-web.css";
import "../globals.css";

/** Bound onto meshi-b's --m-font-display / --m-font-body, as in the mobile tree. */
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-montserrat",
  display: "swap",
});

import { UserProvider } from "../context/UserContext";
import { ThemeProvider } from "../context/ThemeContext";
import { BottomNav } from "@/components/BottomNav";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Crave & Create - AI Food Companion",
  description:
    "Your personal AI food companion. Discover recipes or find the perfect restaurant based on your cravings.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Crave & Create",
  },
  openGraph: {
    title: "Crave & Create - AI Food Companion",
    description:
      "Discover recipes or find the perfect restaurant based on your cravings.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the anti-flash script below rewrites data-theme
    // from localStorage before React hydrates, so server and client legitimately
    // differ for anyone not on the default theme.
    <html
      lang="en"
      className={montserrat.variable}
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        {/* Anti-flash: sets data-theme before React hydrates. meshi is
            LIGHT-first — this default flipped with the design system, and must
            stay in step with <html data-theme> above or every load flashes. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('crave_theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={montserrat.className}>
        <ThemeProvider defaultTheme="light">
        <UserProvider>
          {children}
          <BottomNav />
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: "var(--cc-surface-2)",
                color: "var(--cc-text-primary)",
                border: "1px solid var(--cc-border-strong)",
                borderRadius: "980px",
                fontSize: "14px",
                fontWeight: 400,
                letterSpacing: "-0.016em",
              },
            }}
          />
        </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
