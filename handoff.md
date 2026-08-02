# Handoff — Crave & Create (web + mobile, unified)

Last updated: 2026-08-02. Written for a session with zero prior context.
Supersedes the two separate handoffs that lived in the web and mobile repos.

## Goal

One codebase, one backend, one design system serving a web app and a
Capacitor-wrapped iOS/Android app; plus an admin console that configures plans,
limits, and MCP providers at runtime instead of in code.

Full roadmap: `~/.claude/plans/let-s-revisit-so-far-proud-marshmallow.md`.
That file owns sequencing. This file records state.

## Where the work lives

**Everything below is on the local branch `merge/mobile-into-web`, 13 commits
ahead of `main`, and NOTHING HAS BEEN PUSHED.** `main` is still at `ac8a8cc`.

```
3472969 feat(design): rebuild Restaurants to the Flow 2 artboard
1affc5f feat(design): rebuild Home + Discover to the Flow 2 artboards
7cce503 feat(design): rebuild onboarding to the Flow 1 artboards
ade4ef6 feat(design): mobile tree onto meshi Kitchef — foundation + shell + home
2afa311 feat(design): vendor meshi Kitchef design system + mascots
9e0ad34 feat(native): pre-binary hardening — WebView OAuth, pinned alias, IAP
9984251 feat(mcp): provider registry — generalize the Swiggy integration
b171cf3 feat(admin): admin console API + UI, flags split, platform attribution
695b7b9 feat(auth): single auth chokepoint + DB-driven quota limits
4498bd5 chore(sql): capture 8 undocumented RPCs into source + harden execution
773b32a refactor(app): split into (web) and (mobile) root layouts
03174af Merge remote-tracking branch 'mobile/main'
```

`npx tsc --noEmit` and `next build` are clean (67 routes).

**Database changes ARE already applied to production Supabase**
(`lxaaclelfhjmqrhdqzxp`) even though the code is unpushed. Schema and code are
therefore out of sync until this branch merges — the new tables exist and are
simply unused by the deployed app.

## Phase status

| Phase | Status |
|---|---|
| 0 Pre-flight | done — both repos tagged `pre-merge`; Vercel env diffed |
| 1 native_push migration | **applied** to production |
| 2 capture undocumented RPCs | done — `scripts/sql/rpcs.sql` |
| 3 merge the two repos | done — one conflict (`handoff.md`) |
| 4 `(web)`/`(mobile)` root layouts | done |
| 5 production cutover | **NOT STARTED — blocked on env vars (see below)** |
| 6 auth chokepoint + runtime limits | done, applied |
| 7 admin console API + UI | done, applied |
| 8 MCP provider registry | done, applied |
| 9 native iOS/Android + IAP | code-level done; **binaries blocked on toolchain** |
| 10 meshi re-skin | in progress — 7 of 16 mobile screens rebuilt |

## Blocked on you — nothing proceeds past these

**1. Vercel env vars.** Neither project has `ADMIN_EMAIL`,
`NEXT_PUBLIC_ADMIN_EMAIL`, `RAZORPAY_*`, or `STRIPE_*`. Consequences today:
payments have never worked in production, and the admin console is unreachable
by anyone including you. `requireAdmin` is correctly fail-closed, so the
console stays dead until `ADMIN_EMAIL` is set (you said you would do this) or a
`user_profiles.role = 'admin'` row is seeded.

`.env.local` also still contains the literal placeholder `your-email@gmail.com`
for both admin vars, which is why admin never worked locally either.

**2. Before Phase 5 cutover** the web Vercel project must gain `SWIGGY_CLIENT_ID`
and `NEXT_PUBLIC_SITE_URL` — both exist only on the mobile project. Without them
Swiggy silently switches off at cutover.

**3. `com.cravecreate.app://auth/callback` must be added to Supabase → Auth →
URL Configuration.** Native sign-in cannot work without it (see Dead End 7).

**4. Native toolchain.** `ios/` and `android/` do not exist. Xcode 26.6 is
installed but **CocoaPods is not**, and there is no Android SDK, so
`npx cap add ios` fails at `pod install`. RevenueCat also needs an account plus
products in App Store Connect / Play Console.

**5. Google Maps key is HTTP-referrer-restricted** to the web domain, so the
map falls back on mobile and on localhost. Google Cloud Console allowlist fix, not code.

## Bugs found and fixed (all were live)

- **The chat daily limit never blocked anyone.** `check_and_increment_usage`
  capped `count` at the limit then tested `v_count <= p_limit`; once count
  sticks at the cap that is true forever. Verified against the live function:
  with limit 2, the third call returned `allowed: true`. Fixed by deciding on
  whether the increment actually happened. **Consequence: free users were
  effectively unlimited and are now genuinely capped at 2/day.** Raise it in
  `plans` / `app_config` without a deploy if that is too tight.
- **Paying users were still rate-limited.** `isProUser` was never consulted by
  any metered route. `resolveLimits` now derives the plan from an active
  subscription.
- **Unauthenticated PII disclosure.** The 7 `admin_*` RPCs and `is_pro_user`
  kept Postgres's default `PUBLIC EXECUTE`; all are `SECURITY DEFINER` and
  PostgREST exposes them at `/rest/v1/rpc/<name>` to any anon-key holder.
  `admin_top_users` joins `auth.users` and returns `email`. Revoked to
  `service_role`; `search_path` pinned on all 9 definer functions.
- **`GET /api/admin/flags` was unauthenticated and used the service client.**
  Split into a public anon-client `GET /api/flags` and an admin-only
  `/api/admin/flags`.
- **BYOK bypassed `restricted` status** on all five AI routes — a restricted
  user could paste their own key and keep generating, including placing real
  Swiggy orders. `denyIfRestricted()` now runs before the BYOK branch.
- **`/api/meals/analyze` with `kind:"dish"` was completely unmetered** — a
  server-paid LLM call with a user string in the prompt. Now charged to the
  chat bucket.
- **`user_profiles` leaked `status_reason`** (admin-only note) to the moderated
  user. RLS cannot restrict columns; column-level grants now do.
- **`swiggy_tokens` let a user read their own `access_token`** via PostgREST —
  XSS could exfiltrate a live ordering token. `mcp_connections` uses column
  grants so the token is unreadable.
- **Three App Store rejections in the paywall**: Razorpay on every platform,
  the literal string "finish on the web app for now" (anti-steering), and a
  Restore control with no handler.
- **`ThemeContext` hardcoded `"dark"`** while shared by both root layouts,
  which now have opposite defaults. It silently overrode mobile's light-first
  default. Now takes `defaultTheme`.

## The design re-skin (Phase 10) — read this before continuing

**An approach mistake was made and corrected. Do not repeat it.**

The first attempt applied the design SYSTEM (`meshi-b.css` tokens, type,
components) by recolouring the existing screens, without ever opening
`Meshi Redesign B -Montserrat-.dc.html`. Result: right palette, wrong layouts.

The mockup is **not a re-skin spec**. It is 43 artboards across 9 flows, ~35
unique screens against the app's 16 routes. Roughly 10 designed screens have no
implementation at all.

**Method that works:** read the artboard markup, then build the screen from it.
The file is 190KB — fetch it with `DesignSync.get_file` (project
`bdb767d1-b7ae-42ab-b6ce-30542fa2e99f`), write it to `/tmp`, and extract single
artboards with a script rather than loading it all into context.

### Screens rebuilt to artboards (7 of 16)

| Flow | Screens |
|---|---|
| 1 Onboarding | welcome, location, diet, goal |
| 2 Home & discovery | Home, Discover (`/m/search`), Restaurants |

### Still to rebuild (9)

`chat` (6 hardcoded dark colours), `recipe` (13), `paywall` (11), `plan` (3),
`saved` (2), `inbox` (2), `profile` (1), `buy` + `buy/platform` +
`buy/confirmed` (1 each), `plan/week`, `plan/diet-chart`.

They render and are navigable — tokens, fonts and layout are correct — but
carry white-on-dark treatments that read wrong on cream.

### Designed screens with NO implementation (deferred by explicit decision)

Splash (animated Bo), Meet Bo intro, Buy 1 menu → 2 cart → 3 delivery →
4 tracking, camera capture, Bo's verdict, notification bottom-up prompt, BYOK
key screen, dark-mode Home. The four-step ordering journey and camera logging
need real backend work, not just UI.

### Design system state

- `design/meshi-b.css` — shared tokens/components, consumed by both trees
- `design/meshi-web.css` — desktop shell layer, **not yet imported anywhere**
- `app/(mobile)/m/mobile.css` — mobile-only utilities meshi-b lacks
- `components/mascots/*` — 13 mascots + lookup map
- **Mobile tree is fully off `--cc-*` (grep returns zero). Web tree still uses
  it across 29 files** — the web re-skin has not started.

### Traps already hit — do not rediscover

- **`.row` means different things in the two systems.** Old stylesheet: flex
  utility (89 uses). meshi-b: padded list-row CARD. All 89 renamed to
  `.hstack`; `.row` is reserved for genuine list rows (the onboarding goal step
  is the one legitimate use). `mobile.css` deliberately does not define it.
- **Dropping `globals.css` from mobile also dropped Tailwind's preflight**, and
  meshi-b ships no reset. Everything measured content-box — the tab bar
  rendered 406px wide in a 390px viewport. `mobile.css` now carries a minimal
  reset.
- **meshi-b declares `.tabbar { position: absolute }`** — right for a
  fixed-height artboard, wrong for a scrolling app. Overridden to fixed.
- **`.win`, `.win-bar`, `.win-url`, `.win-body` are the mockup's FAKE BROWSER
  CHROME.** Never port them into `app/**`.
- **The Restaurants artboard's illustrated map is the same kind of stand-in.**
  Decision taken: keep the real Google Map, restyle it to the artboard palette,
  and take the pins/chips/detail-card from the design.
- **The tab bar is Home / Discover / Bo / Plan / Profile** — there is no Saved
  tab. Saved is reached from Profile.
- **Console errors after an HMR edit are frequently stale buffer entries.**
  `BoBowl is not defined` and `Heart is not defined` both appeared after their
  imports had landed. Verify in a fresh tab before chasing them.

## Architecture

```
app/
  (web)/       root layout #1 — Tailwind + globals.css, dark-first, BottomNav
  (mobile)/    root layout #2 — design/meshi-b.css + m/mobile.css, LIGHT-first,
               Montserrat via next/font, no globals.css
  api/         one copy of every route handler, outside both groups
design/        meshi-b.css, meshi-web.css
lib/           supabase, auth-guard, limits, audit, billing, mcp/*, native-*
components/    cc/ (legacy, web only), ui/, mobile/, mascots/, planner/
```

- `app/global-not-found.tsx` exists because multiple root layouts mean an
  unmatched URL has no layout to render in; without it Next falls back to its
  built-in 404.
- Both root layouts need `suppressHydrationWarning` — the anti-flash script
  rewrites `data-theme` before React hydrates.

## Key tables (all applied to production)

`plans`, `plan_prices`, `user_profiles`, `app_config`, `admin_audit_log`,
`mcp_providers`, `mcp_provider_servers`, `mcp_connections` — plus the
pre-existing `usage`, `usage_photo`, `pro_subscriptions`, `meal_logs`,
`nutrition_goals`, `notification_subscriptions`, `notification_log`,
`swiggy_tokens`, `feature_flags`.

`swiggy_tokens` is migrated into `mcp_connections` and no longer written —
drop it one release after this ships.

**Trap:** `create or replace function` RESETS a function's ACL to
`PUBLIC EXECUTE`. The `revoke`/`grant` block at the bottom of `rpcs.sql` and
`admin-console.sql` must always run last. Reordering silently reopens the PII
hole.

`app_config` and `admin_audit_log` have RLS enabled with ZERO policies. That is
deliberate: service-role only. The Supabase advisor reports them as INFO lints;
ignore those two.

## Dead ends — do not retry

1. **Swiggy MCP OAuth from a web origin.** Gated to an allowlist of AI clients;
   a custom origin gets "Oops, Vercel isn't whitelisted yet". The Phase 8
   registry makes the SYSTEM provider-agnostic but cannot make a third party
   accept us. Instacart/Zomato/Uber are seeded as disabled placeholders with no
   endpoint URLs because no public MCP endpoint is known for any of them.
2. **`whileInView` with `initial={{ opacity: 0 }}`.** Renders as a black void in
   headless capture. Animate transform only. The web landing page still
   violates this and should be fixed during the web re-skin.
3. **Blanket `sed` over hardcoded hex.** Corrupted the Razorpay `theme.color`,
   which runs in a third-party iframe where CSS custom properties do not
   resolve. Convert file by file.
4. **Trusting Bash cwd across worktrees.** Run `pwd` before any git write.
5. **Deleting branches without an explicit ask.** The user has declined twice,
   including `local-backup` (an orphan root commit — the only one with
   genuinely unrecoverable content).
6. **`npm run build` without dummy Supabase env** fails during prerender.
   Prefix with `NEXT_PUBLIC_SUPABASE_URL="https://dummy.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="dummy"`.
7. **Google OAuth inside a Capacitor WebView** returns `disallowed_useragent`.
   Fixed via `@capacitor/browser` + the `com.cravecreate.app://` deep link in
   `lib/native-auth.ts`, but it needs the Supabase redirect URL added (blocker 3).
8. **`rm -rf .next` while the dev server is running** breaks it with ENOENT
   manifest errors that look like app failures. Restart the server.
9. **Deleting `app/(mobile)/m/meshi.css` requires converting every screen
   first** — it was the only definition of `.col`, `.scroll`, `.ph-*`, etc.
   `mobile.css` now provides them.

## Key decisions

- **One Next app, two root-layout route groups**, not a Turborepo — App Router
  route handlers cannot live in a shared package.
- **Capacitor stays** (remote-URL). `server.url` **must be pinned to a promoted
  alias before `npx cap add ios`** — it is frozen into every install forever,
  and an auto-advancing alias means one bad web deploy bricks every app with no
  store rollback. Currently reads `CAP_PROD_URL` and still defaults to the old
  auto-advancing alias.
- **RevenueCat** for IAP. Until products exist, `/api/billing/options` reports
  `canPurchase: false` for ios/android and the paywall shows only the free BYOK
  path — compliant and shippable rather than a dead purchase button.
- **`allowNavigation` lost its `*.vercel.app` wildcard**, which had let the
  WebView navigate to anyone's Vercel deployment.
- **Fail-mode asymmetry preserved deliberately**: chat fails open, photo fails
  closed on `PGRST202`. Harmonizing it in the same change as DB-driven limits
  would make a regression unbisectable. Parked behind
  `app_config['limits.fail_mode']`.
- **Audit logging is best-effort** — a failed audit write does not block the
  mutation. Revisit if this ever backs a compliance requirement.
- **The orange `#ff6b35` is retired** in favour of forest green. This reaches
  beyond CSS: `UpgradeDialog`'s Razorpay `theme.color` and
  `scripts/gen-resources.mjs` both still bake it into checkout and app icons,
  and `resources/*.png` needs regenerating.

## Environment

- Supabase `lxaaclelfhjmqrhdqzxp`; both apps already shared it before this work.
- 6 users, 3 active in 30 days. `pro_subscriptions` empty. No native binary has
  ever shipped.
- Migrations are plain `.sql` in `scripts/sql/`, applied by hand. No migration
  tool.
- No test suite. `npx tsc --noEmit`, `next build`, and screenshot diffs are the
  only gates.
- Both deployments still live and serving the OLD code:
  `create-shop-crave.vercel.app` and `create-shop-crave-mobile.vercel.app/m`.
- `proxy-server/` contains only `node_modules` and is referenced by two env
  vars but zero source files — dead scaffold, safe to delete.

## Suggested next step

Flow 3 (chat + recipe) — the product's core loop and the heaviest colour debt
(recipe alone has 13 hardcoded dark values). Then Flow 6 (tracking), Flow 7
(saved/profile/paywall), Flow 4 (buy).

Alternatively, push this branch for review first — it is 13 commits and touches
auth, payments, the database and the entire mobile UI.
