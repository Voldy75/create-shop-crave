import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for the Crave & Create mobile shell.
 *
 * Remote-URL mode: the native app loads the deployed mobile web frontend
 * (this same repo, deployed to its own Vercel project). The App Router app
 * can't static-export cleanly, so we point at the live URL instead of
 * bundling static assets. Web changes ship without a store re-review.
 *
 * `CAP_SERVER_URL` lets dev point at a LAN/dev server (e.g. http://192.168.x.x:3000)
 * for live-reload during development. In CI/release builds it's the prod URL.
 */
// Stable public production alias for this repo's Vercel project. The native
// shell loads the /m subtree (the meshi mobile frontend). Use the clean
// `.vercel.app` alias — the per-deployment and team-scoped URLs have Vercel
// deployment protection (401), which would block the WebView.
// The mobile UI lives under /m (the web routes stay at root for the PWA).
// Launch the WebView straight into /m so users land on the meshi Home.
const PROD_URL = "https://create-shop-crave-mobile.vercel.app/m";
const SERVER_URL =
  process.env.CAP_SERVER_URL || // LAN dev server for live-reload, e.g. http://192.168.x.x:3000/m
  PROD_URL;

const config: CapacitorConfig = {
  appId: "com.cravecreate.app",
  appName: "Crave & Create",
  webDir: "public", // unused in remote-URL mode, but required by the schema
  server: {
    url: SERVER_URL,
    cleartext: false,
    // Domains the WebView may navigate to without bouncing to an external browser.
    // mcp.swiggy.com is required for the Swiggy OAuth authorize/redirect dance.
    allowNavigation: [
      "create-shop-crave.vercel.app",
      "*.vercel.app",
      "mcp.swiggy.com",
      "*.supabase.co",
    ],
  },
  ios: {
    contentInset: "always",
  },
  android: {
    // Allow the custom scheme used for OAuth deep-link return.
    allowMixedContent: false,
  },
};

export default config;
