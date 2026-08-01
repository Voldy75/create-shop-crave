import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import localFont from "next/font/local";
import "../globals.css";

const generalSans = localFont({
  src: "../fonts/GeneralSans-Variable.woff2",
  variable: "--font-display",
  weight: "200 700",
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
      className={`${GeistSans.variable} ${generalSans.variable}`}
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        {/* Anti-flash: sets data-theme before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('crave_theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={GeistSans.className}>
        <ThemeProvider>
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
