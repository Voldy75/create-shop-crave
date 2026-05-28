# Handoff — Crave & Create Mobile

## Goal
Ship the existing "Crave & Create" food web app as a store-listed iOS + Android app
**without modifying the original web repo**. Approach: Capacitor native shell
(remote-URL mode) loading a mobile-optimized Next.js UI built under `app/m/*` in
THIS fork. "Done" = signed builds live on TestFlight + Play Internal track, then
App Store + Play Store approval. All backend/Supabase/integrations are reused
verbatim — only the mobile UI + native bridge are new here.

## Current State
- **Web/mobile build is in a known-good state.** `npx tsc --noEmit` is clean and
  `next build` passes (53 routes) with dummy env. Tree is fully committed on `main`,
  pushed to `github.com/Voldy75/create-shop-crave-mobile`. HEAD = `5993470`.
- **All mobile screens (`app/m/*`) are built and wired to backend** — onboarding,
  home, chat, recipe, restaurants, full buy-journey, meal tracker (today/week/
  diet-chart), saved, profile, paywall, inbox, search. These render as web; not yet
  verified inside an actual native WebView.
- **Design pass DONE this session** — every screen was screenshotted live at
  390×844 against the deployed prod URL and critiqued. Score went 5.5/10 → 8/10.
  Real food imagery via keyword lookup landed across home/recipe/restaurants/
  discover; live Google Maps code landed in `/m/restaurants`; Plan empty state
  warmed; brand unified to "meshi". See commits `b680a58`, `0fee7d4`, `5993470`.
- **Native bridge code (M3) is complete but UNVERIFIED on-device** — it cannot run
  until `npx cap add ios/android` is done on the user's Mac. The code build-checks
  fine (dynamic imports of `@capacitor/*` resolve) but has never executed natively.
- **Native push delivery (FCM) is written but never sent a real message** — gated on
  `FIREBASE_SERVICE_ACCOUNT` env which is NOT set. Skips cleanly when unset.
- **No native projects exist yet** — there is no `ios/` or `android/` directory.

### Built but NOT production-grade (do not mistake for done)
- **Paywall** (`app/m/paywall/page.tsx`) — CTA calls `/api/subscribe/razorpay` but the
  Razorpay checkout SDK is not wired; payment does not complete end-to-end.
- **Restaurants map** (`components/mobile/RestaurantMap.tsx`) — code now renders
  real dark-styled Google Maps tiles via `@react-google-maps/api`, BUT production
  falls back to the gradient because the shared Maps API key is HTTP-referrer-
  restricted to the web domain only. Console shows `RefererNotAllowedMapError`.
  Fix: add `https://create-shop-crave-mobile.vercel.app/*` (and the Capacitor
  scheme) to that key's allowed referrers in Google Cloud Console. Code is fine
  — degrades gracefully until then.
- **Instacart native-cart** — deferred; needs a platform API. The buy-journey routes to
  Instamart (agent) + deeplinks only.
- **Splash variants** from the meshi design were not built (the generated `resources/`
  splash is the only one).

## Files in Play
All committed and working unless noted.
- `app/m/(tabs)/page.tsx` — Home; added streak chip + "Order again" reorder card. working
- `app/m/(tabs)/plan/page.tsx` — meal tracker; added native-camera path + "This week ›" link. working
- `app/m/plan/week/page.tsx` — new; 7-day calorie bars from meal_logs. working
- `app/m/plan/diet-chart/page.tsx` — new; AI 7-day plan via /api/coach, applies to planner. working
- `app/m/inbox/page.tsx` — Push filter now includes native_push. working
- `app/m/layout.tsx` — mounts `<NativeInit/>`. working
- `components/mobile/NativeInit.tsx` — new; runs initDeepLinks + registerNativePush on native only. working (web no-op verified; native unverified)
- `lib/native-bridge.ts` — registerNativePush() + initDeepLinks() fully wired (were stubs). working build; native unverified
- `lib/native-push.ts` — new; FCM HTTP v1 sender, JWT via node:crypto. compiles; never executed against real FCM
- `lib/nutrition.ts` — added `loggingStreak()` pure helper. working
- `app/api/notifications/native/register/route.ts` — new; persists APNs/FCM token. compiles; never hit by a real device
- `app/api/cron/daily-nudge/route.ts` — added native_push channel send/log/dead-token-clear. compiles; native branch never exercised
- `scripts/sql/notifications.sql` — added native_push_{enabled,token,platform} cols + widened notification_log channel check. NOT YET APPLIED to Supabase
- `scripts/gen-resources.mjs` — new; renders icon/splash PNGs via sharp. working (ran successfully)
- `resources/{icon,splash,splash-dark}.png` — new; generated brand placeholders. committed
- `package.json` — added `gen:resources` + `assets` scripts. working
- `.env.example` — added FIREBASE_SERVICE_ACCOUNT placeholder. working
- `MOBILE_SETUP.md` — status synced + store-submission checklist. working
- `capacitor.config.ts` — appId `com.cravecreate.app`, server.url `https://create-shop-crave-mobile.vercel.app/m`. working (from earlier session)

Added/touched in the design pass (this session):
- `lib/food-images.ts` — new; keyword→TheMealDB CDN photo lookup, no API key, gradient fallback. working
- `components/mobile/RestaurantMap.tsx` — new; live Google Maps with dark style + numbered markers + auth-failure fallback. working; prod blocked on referrer allowlist
- `app/m/restaurants/page.tsx` — replaced fake mapbg+PIN_POS with `<RestaurantMap>`. working
- `app/m/(tabs)/page.tsx` — cravings + editor's picks tiles render real food photos. working
- `app/m/recipe/page.tsx` — hero shows real food photo behind gradient. working
- `app/m/search/page.tsx` (Discover) — featured + collections show real food photos. working
- `app/m/(tabs)/plan/page.tsx` — empty state now icon + goal-aware copy + CTA. working
- `app/m/(tabs)/profile/page.tsx` — footer "meshi · Crave & Create" → "meshi". working
- `app/m/inbox/page.tsx` — added Sign in button on the unauthenticated empty state. working

## Changes Made (vs session start)
- New tracker sub-screens (`week`, `diet-chart`) under `app/m/plan/`.
- M3 native bridge: `registerNativePush()` (permission → token → POST register) and
  `initDeepLinks()` (appUrlOpen → router.replace) implemented in `lib/native-bridge.ts`;
  `NativeInit` component wires them in the `/m` shell.
- New API route `/api/notifications/native/register` (mirrors web-push subscribe).
- New `lib/native-push.ts` — FCM v1 sender minting OAuth2 token by signing a JWT with
  `node:crypto` (no new deps).
- `daily-nudge` cron extended with a native_push channel (send, log, clear dead tokens).
- DB schema: 3 new columns on `notification_subscriptions` + `native_push` added to
  both `notification_log.channel` check and the active-subscribers index/`.or()` query.
- N1 features: `loggingStreak()` helper; Home streak chip + 1-tap reorder card; inbox
  Push filter includes native_push.
- Asset pipeline: `scripts/gen-resources.mjs`, committed `resources/*.png`, npm scripts.
- No npm dependencies were installed this session (all `@capacitor/*` were already present).
- Design pass commits: `b680a58` (imagery), `0fee7d4` (live map + plan empty
  state + brand), `5993470` (Discover photos + inbox sign-in CTA).
- Visual audit: 11 screens screenshotted live at 390×844 against the deployed
  prod URL via the gstack `browse` binary. Score 5.5 → 8/10.

## Dead Ends — Do Not Retry
- **Visual QA — solved this session, but with a sandbox catch.** Forget the MCP
  Chrome/Preview tools (`mcp__Control_Chrome__execute_javascript`, `mcp__Claude_
  Preview__preview_screenshot`) — both failed last session because nothing was
  attached. The path that works: gstack `browse` binary at
  `~/.claude/skills/gstack/browse/dist/browse` against the deployed prod URL.
  Set `$B viewport 390x844`, then `$B goto <url>`, `$B wait --networkidle`,
  `$B screenshot <path>`. **Catch:** screenshot path is sandboxed to
  `/private/tmp/...` or the current worktree — writing to `~/.gstack/...` fails
  with "Path must be within: /private/tmp, …". Just dump to `/private/tmp/<dir>/`
  and Read them. Don't waste a retry on the sandbox error.
- **`npm run build` fails WITHOUT dummy Supabase env.** Error:
  `@supabase/ssr: Your project's URL and API key are required to create a Supabase client!`
  during prerender of `/m/buy/confirmed` (and others). Root cause: static prerender
  instantiates the Supabase client at build time. Fix that works: prefix the build with
  `NEXT_PUBLIC_SUPABASE_URL="https://dummy.supabase.co" NEXT_PUBLIC_SUPABASE_ANON_KEY="dummy" GOOGLE_AI_API_KEY="dummy"`.
  This is expected, not a bug — don't try to "fix" the prerender.
- **`curl` inside a zsh `declare -A` subshell threw `curl: command not found`.** Use a
  plain loop or `CURL=$(command -v curl)`. Minor, but it cost a retry.

## Key Decisions & Assumptions
- **meshi UI, NOT Food-Kuu** — user was explicit. `--cc-*` tokens, plain CSS + inline
  styles, NOT Tailwind, in `app/m/meshi.css`. Accent `#ff6b35`, dark-first.
- **Remote-URL Capacitor**, not static export — App Router uses server components/API
  routes that can't `next export`. `server.url` points at the deployed Vercel app.
- **Auth = Google OAuth only** (no Email OTP), **diet chart = 7-day** (not 14) — both
  decided to minimize backend change.
- **FCM HTTP v1 chosen for native push** (handles both Android FCM and iOS APNs via
  Firebase) over per-platform SDKs — avoids deps, one code path. **Assumption unverified:**
  the JWT-signing + token-exchange + send flow in `lib/native-push.ts` has never run;
  next session should smoke-test it once `FIREBASE_SERVICE_ACCOUNT` is set.
- **`resources/*.png` are placeholder brand art** (orange square + "C"), generated, not
  designed. Fine for a build; replace before public launch.
- **Secrets policy:** real secrets only in gitignored `.env.local`; `.env.example` holds
  empty placeholders. Credentials shared in the original chat (Twilio token, VAPID key,
  CRON_SECRET) should be ROTATED by the user.
- **Imagery strategy = keyword → TheMealDB CDN, no key.** `lib/food-images.ts`
  maps ~16 keywords (chicken/biryani/pizza/etc.) to public TheMealDB image URLs.
  No env var, no quota, deterministic. Falls back to the existing `ph-*`
  gradients when no keyword matches (graceful — see "Five 20-minute dinners"
  keeping its gradient as designed). **Do NOT apply imagery to ingredient-level
  tiles** (buy-journey grocery items) — dish photos mislead for "Tomato passata"
  / "Butter". The next imagery tier is an Unsplash Access Key for exact-dish
  matches; the user has not been asked yet whether they want that.
- **Maps key referrer restriction is a real prod blocker** — not a code bug.
  Verified by reading console: `RefererNotAllowedMapError` on every page load.
  The `gm_authFailure` handler in `RestaurantMap` catches it and falls back, so
  the screen never appears broken. But until the referrer allowlist is updated,
  prod will keep showing the gradient.

### Architecture conventions (easy to break — read before adding screens)
- **Route layout:** `/m` = bare shell (`app/m/layout.tsx`, mounts `<NativeInit/>`).
  `app/m/(tabs)/` = route group that adds the bottom tab bar — put tabbed screens here.
  Full-screen drill-ins (recipe, buy/*, plan/week, etc.) go DIRECTLY under `app/m/`,
  NOT in `(tabs)`, so they render without the tab bar. Moving a file between these
  changes its chrome.
- **Cross-screen object handoff:** recipe/restaurant objects pass between screens via
  `lib/mobile-handoff.ts` (sessionStorage): `setActiveRecipe/getActiveRecipe`,
  `setActiveRestaurants/getActiveRestaurants`. Screens read these on mount with a
  fallback; don't expect router state to carry objects.
- **Next 16 quirk:** any client screen using `useSearchParams`/`usePathname` must be
  wrapped in `<Suspense>` or the build fails. Existing screens already do this.
- **Tokens:** meshi classes live in `app/m/meshi.css` (`t-h1/card/pill-primary/chip/
  glass/ph-*` etc.). Reuse them; do not introduce Tailwind into `app/m/*`.
- **Original web repo `create-shop-crave` is FROZEN** — never edit it. All mobile work
  is additive under `app/m/*`, `components/mobile/*`, and the shared backend/libs here.

## Next Steps (in order)
1. **Maps referrer fix (cheapest, biggest visual win).** Google Cloud Console →
   the existing Maps API key → Application restrictions → HTTP referrers → add
   `https://create-shop-crave-mobile.vercel.app/*`. Real dark map tiles replace
   the gradient immediately on next load. Verify by re-running the screenshot
   loop on `/m/restaurants`.
2. On a Mac with Xcode + Android Studio: `cd ~/projects/create-shop-crave-mobile && npx cap add ios && npx cap add android` (creates `ios/`, `android/`).
3. `npm run gen:resources && npm run assets` — expands `resources/` into all native icon/splash sizes.
4. Apply DB migration: run `scripts/sql/notifications.sql` against Supabase project `lxaaclelfhjmqrhdqzxp` (idempotent; adds native_push columns). Verify with `select column_name from information_schema.columns where table_name='notification_subscriptions';`.
5. In Supabase Auth dashboard, add `com.cravecreate.app://` to allowed redirect URLs; register the same custom scheme with Swiggy via DCR; ALSO add the Capacitor scheme to the Maps key's referrer allowlist.
6. `npx cap sync && npx cap run ios` (and android) — FIRST on-device smoke test. Verify: app loads the remote URL, Google OAuth returns into the WebView via the custom scheme (this is the highest-risk unverified path), camera opens in the plan log sheet.
7. (Optional, for push) Set `FIREBASE_SERVICE_ACCOUNT` env in Vercel; add APNs auth key in Firebase console; trigger `/api/cron/daily-nudge?token=<CRON_SECRET>&dry=1` then live, confirm a native notification arrives.
8. (Optional, for imagery beyond ~16 keyword buckets) Add an Unsplash Access Key
   and extend `lib/food-images.ts` to query the Unsplash Search API per dish.
   Pending user decision.
9. Store submission — follow the checklist in `MOBILE_SETUP.md`.

## Open Questions
- Does the **Supabase OAuth PKCE cookie flow survive the iOS WKWebView + custom-scheme
  return**? Unverified and the single biggest risk. Must be tested in step 5.
- Is `com.cravecreate.app://` actually registered with Swiggy yet? Unknown — user-side.
- Has the user created the **Firebase project** at all? `FIREBASE_SERVICE_ACCOUNT` is
  just a placeholder; native push won't work until it exists + an APNs key is uploaded.
- The PROD deployment URL in `capacitor.config.ts` is `create-shop-crave-mobile.vercel.app`.
  Confirmed live + public this session (HTTP 200, all routes loaded under
  gstack browse). Not behind Vercel auth-protection.
- **Does the user want Unsplash imagery** (exact-dish photos beyond the ~16
  keyword buckets) — flagged at end of session, awaiting their call.

## Environmental Notes
- Repo path: `~/projects/create-shop-crave-mobile`. Branch `main`, clean working tree, pushed.
  (Note: the shell in the last session kept resetting cwd to a different worktree —
  always `cd ~/projects/create-shop-crave-mobile` explicitly before running commands.)
- Build requires dummy env (see Dead Ends). Type-check `npx tsc --noEmit` needs nothing.
- Supabase project: `lxaaclelfhjmqrhdqzxp` (shared with the web app, unchanged).
- No `ios/`/`android/` dirs yet — most `npx cap` commands beyond `add` will fail until step 1.
- Vercel: this fork is its own project; env vars must be copied from the web project
  (Supabase, GOOGLE_AI_API_KEY, TWILIO_*, VAPID_*, CRON_SECRET, SWIGGY_CLIENT_ID) plus
  the new FIREBASE_SERVICE_ACCOUNT.
- `sharp` is installed (dep of `@capacitor/assets`) — `gen:resources` relies on it.
