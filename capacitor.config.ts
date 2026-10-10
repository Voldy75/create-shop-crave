import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for the Crave & Create mobile shell.
 *
 * Remote-URL mode: the native app loads the deployed mobile web frontend. The
 * App Router app can't static-export cleanly, so we point at a live URL instead
 * of bundling static assets. Web changes ship without a store re-review.
 *
 * `CAP_SERVER_URL` lets dev point at a LAN/dev server (e.g.
 * http://192.168.x.x:3000/m) for live-reload during development.
 */

/**
 * ⚠️  THIS URL IS FROZEN INTO EVERY INSTALLED APP, FOREVER.
 *
 * It must be a **pinned alias you promote to deliberately** — never an alias
 * that auto-advances to the newest production deployment.
 *
 * Why this matters more than it looks: with an auto-advancing alias, any bad
 * web deploy instantly bricks every installed app, and there is no store
 * rollback for content the binary fetches at runtime. With a pinned alias, the
 * same incident is a 30-second re-point.
 *
 * Changing it is free right now and IMPOSSIBLE after the first binary ships,
 * because old installs keep requesting whatever URL was compiled into them.
 *
 * SETUP (do this before `npx cap add ios`):
 *   1. In Vercel, add a dedicated alias to the create-shop-crave project —
 *      e.g. `m.cravecreate.app`, or `crave-mobile-live.vercel.app`.
 *   2. Point PROD_URL at it (keep the /m suffix).
 *   3. Promote deployments to that alias deliberately, not automatically.
 *
 * Until step 1 is done this still points at the old mobile project's
 * auto-advancing alias, which is the exact hazard described above.
 */
const PROD_URL =
  process.env.CAP_PROD_URL ?? "https://create-shop-crave-mobile.vercel.app/m";

const SERVER_URL = process.env.CAP_SERVER_URL || PROD_URL;

const config: CapacitorConfig = {
  appId: "com.cravecreate.app",
  appName: "Crave & Create",
  webDir: "public", // unused in remote-URL mode, but required by the schema
  server: {
    url: SERVER_URL,
    cleartext: false,
    /**
     * Domains the WebView may navigate to WITHOUT bouncing to an external
     * browser. Keep this list exact.
     *
     * A wildcard like "*.vercel.app" let the WebView navigate to ANY Vercel
     * deployment on the internet — a link in AI-generated content could have
     * silently loaded a stranger's site inside our authenticated shell.
     *
     * Note that Google OAuth deliberately is NOT here: Google refuses to render
     * its consent screen inside an embedded WebView (`disallowed_useragent`),
     * so that flow must open in the system browser via @capacitor/browser. See
     * lib/native-auth.ts.
     */
    allowNavigation: [
      "create-shop-crave.vercel.app",
      "create-shop-crave-mobile.vercel.app",
      "mcp.swiggy.com",
      "lxaaclelfhjmqrhdqzxp.supabase.co",
    ],
  },
  ios: {
    contentInset: "always",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
