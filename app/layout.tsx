import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { UserProvider } from "./context/UserContext";
import { ThemeProvider } from "./context/ThemeContext";
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
    <html lang="en" className={GeistSans.variable} data-theme="dark">
      <head>
        {/* Anti-flash: sets data-theme before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('crave_theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body
        className={GeistSans.className}
        style={{
          fontFamily:
            '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
        }}
      >
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
