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
const SERVER_URL =
  process.env.CAP_SERVER_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  // TODO(M1): replace with the fork's own Vercel deployment URL once created.
  // Until the new mobile frontend (M2) is deployed, this points at the
  // existing prod web app so `cap run` smoke-tests the wrapper end-to-end.
  "https://create-shop-crave.vercel.app";

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
