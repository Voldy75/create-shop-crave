# Handoff — Crave & Create (web + mobile, unified)

Last updated: 2026-08-01. Written for a session with zero prior context.
Supersedes the two separate handoffs that lived in the web and mobile repos.

## Goal

One codebase, one backend, one design system serving a web app and a
Capacitor-wrapped iOS/Android app; plus an admin console that configures plans,
limits, and MCP providers at runtime instead of in code.

Full roadmap: `~/.claude/plans/let-s-revisit-so-far-proud-marshmallow.md`.
That file owns sequencing. This file records state.

## What just happened

The mobile repo (`github.com/Voldy75/create-shop-crave-mobile`) was a **fork** of
the web repo, not a separate project. Both were live on separate Vercel projects,
both already pointed at the **same** Supabase project, and the entire backend
(~25 API routes, `lib/*`) was duplicated and drifting.

Fork point: `552ac38`. Since then web changed 42 files, mobile 40, overlapping on
exactly one — this file. `git merge mobile/main` produced a single conflict.

## Current state

| Phase | Status |
|---|---|
| 0 — Pre-flight | done. Both repos tagged `pre-merge`. Vercel env diffed (findings below). |
| 1 — native_push DB migration | **applied** to `lxaaclelfhjmqrhdqzxp`. 12 columns on `notification_subscriptions`; `notification_log.channel` accepts `native_push`. |
| 2 — capture undocumented RPCs | done, on branch `chore/capture-rpcs-and-harden-db` (`scripts/sql/rpcs.sql`). **Not yet merged.** |
| 3 — merge repos | this commit. |
| 4–10 | not started. See the plan file. |

## Findings that need YOUR action

**1. Neither Vercel project has payment or admin credentials.** `vercel env ls`
on both shows no `ADMIN_EMAIL`, `NEXT_PUBLIC_ADMIN_EMAIL`, `RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`, or
`STRIPE_WEBHOOK_SECRET`. In production today:
  - The admin console locks out everyone. `app/api/admin/stats/route.ts` reads
    `ADMIN_EMAIL`; undefined means the gate 403s every caller, and the
    client-side `NEXT_PUBLIC_ADMIN_EMAIL` check renders "Admin Access Only" for
    everyone including you.
  - Razorpay and Stripe checkout cannot work. Payments have never functioned in
    production.

**2. The mobile deployment's Gemini key has the wrong name.** Mobile sets
`GOOGLE_AI_API_KEY`; web sets `GOOGLE_GENERATIVE_AI_API_KEY`.
`lib/providers.ts` `getServerModel()` calls `google("gemini-2.5-flash")` from
`@ai-sdk/google`, whose default factory reads `GOOGLE_GENERATIVE_AI_API_KEY` by
SDK convention. **No code anywhere reads `GOOGLE_AI_API_KEY`.** Every non-BYOK
AI call on `create-shop-crave-mobile.vercel.app` — chat, coach, ingredients,
meal analysis — has been failing. The merge fixes this by consolidating onto the
web project's env surface.

**3. Before the Phase 5 cutover, the web Vercel project must gain
`SWIGGY_CLIENT_ID` and `NEXT_PUBLIC_SITE_URL`.** Both exist only on the mobile
project. `lib/swiggy-oauth.ts` gates on `SWIGGY_CLIENT_ID` and falls back to the
request host for `redirect_uri` without `NEXT_PUBLIC_SITE_URL`. Not copying them
silently turns Swiggy off at cutover.

All of the above are secrets or account settings — set them yourself in the
Vercel dashboard. Do not paste secret values into a chat session.

**4. Supabase Auth redirect URLs still need checking** for
`com.cravecreate.app://`. Not reachable through the Supabase MCP tools; check
Authentication → URL Configuration in the dashboard. If absent, native Google
sign-in is already broken (see Dead End 7).

## Security fix applied this session

The 7 `admin_*` RPCs and `is_pro_user` existed only in the live DB and had kept
Postgres's **default `PUBLIC EXECUTE` grant**. All are `SECURITY DEFINER`, and
PostgREST exposes every public-schema function at `POST /rest/v1/rpc/<name>` to
any holder of the anon key — which ships in the client bundle and is public by
design. `admin_top_users` joins `auth.users` and returns `email`, so this was an
**unauthenticated PII disclosure**.

Fixed: EXECUTE revoked from `public`/`anon`/`authenticated`, granted to
`service_role` only. Both callers (`app/api/admin/stats/route.ts`,
`lib/subscription.ts`) already use `createServiceClient()`, so nothing broke.
`search_path` pinned to `''` on all 9 `SECURITY DEFINER` functions, clearing
every Supabase `function_search_path_mutable` lint. The security advisor now
reports no function findings.

**Trap for whoever edits `scripts/sql/rpcs.sql`:** `create or replace function`
**resets the ACL to the default `PUBLIC EXECUTE`**. The `revoke`/`grant` block at
the bottom of that file must always run after the definitions. Reordering it
silently reopens the hole.

## Known bug, not yet fixed

**Paying users are still rate-limited.** `isProUser` is referenced only in
`lib/subscription.ts` and `app/api/subscribe/status/route.ts` — never by
`/api/chat`, `/api/agent`, `/api/coach`, or `/api/meals/analyze`. A ₹749
customer is capped at 2 chats/day; only BYOK bypasses the quota. The
`is_pro_user` RPC itself does correctly enforce `current_period_end`. Fixed by
`lib/limits.ts` in Phase 6.

## Dead ends — do not retry

1. **Swiggy MCP OAuth from a web origin.** Swiggy gates to a hardcoded allowlist
   of AI clients; a custom origin gets "Oops, Vercel isn't whitelisted yet"
   regardless of correct DCR/PKCE. Do not re-attempt without confirmed
   whitelist access.
2. **`whileInView` with `initial={{ opacity: 0 }}`.** Renders as a black void in
   headless capture. Animate transform only.
3. **Blanket `sed` over hardcoded hex.** Corrupted `UpgradeDialog.tsx` — the
   Razorpay `theme.color` runs in a third-party iframe where CSS custom
   properties do not resolve. Exclude third-party SDK config, Maps style JSON,
   and SVG data-URIs from any bulk color sweep.
4. **Trusting Bash cwd across worktrees.** This repo has extra git worktrees; a
   `cd` persists across calls. Run `pwd` before any git state-changing command.
5. **Deleting branches without an explicit ask.** Most stale branches point at
   already-merged PRs. The user has declined cleanup twice, including
   `local-backup` (an orphan root commit — the only one with unrecoverable
   content).
6. **`npm run build` without dummy Supabase env** fails during prerender. Prefix
   with `NEXT_PUBLIC_SUPABASE_URL="https://dummy.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="dummy"`. Expected, not a bug.
7. **Google OAuth inside a Capacitor WebView** returns `disallowed_useragent` and
   will not render consent. Policy since 2021, no client-side workaround. Must
   use `@capacitor/browser` (SFSafariViewController / Custom Tabs) with the
   `com.cravecreate.app://` deep link, which `initDeepLinks()` already handles.

## Key decisions

- **One Next app, two root-layout route groups** (`app/(web)`, `app/(mobile)`),
  not a Turborepo — App Router route handlers cannot live in a shared package,
  and two Vercel projects over one repo preserves the double-cron bug.
- **Capacitor stays** (remote-URL). `app/m/*` is a working Next UI and the four
  native needs are already abstracted behind `lib/native-bridge.ts`.
- **`server.url` must be pinned to a dedicated alias before `npx cap add ios`.**
  It currently tracks an auto-advancing production alias; once a binary ships,
  a bad web deploy bricks every install with no store rollback. Free to fix now,
  impossible later.
- **RevenueCat** for iOS + Android IAP. Apple mandates IAP for digital
  subscriptions; Razorpay checkout in the iOS build is an automatic rejection.
- **The design system is being replaced wholesale** — Claude Design project
  `bdb767d1-b7ae-42ab-b6ce-30542fa2e99f` ("Meshi Kitchef"), read via the
  `DesignSync` MCP. Light-first warm cream, forest-green primary, Montserrat,
  13 mascot SVGs. Retires both Midnight Kitchen (`--cc-*`) and the old meshi
  tokens, and retires `#ff6b35` — including the Razorpay checkout theme and the
  generated app icons in `scripts/gen-resources.mjs`.

## Architecture conventions (easy to break)

- **Route layout:** `app/m` is the mobile shell. `app/m/(tabs)/` adds the bottom
  tab bar; full-screen drill-ins go directly under `app/m/`. Moving a file
  between them changes its chrome.
- **Cross-screen object handoff** goes through `lib/mobile-handoff.ts`
  (sessionStorage), not router state.
- **Next 16:** any client screen using `useSearchParams`/`usePathname` must be
  wrapped in `<Suspense>` or the build fails.
- **`components/ui/`** is stock shadcn; **`components/cc/`** is brand primitives.
  Both are superseded by the meshi re-skin in Phase 10.
- `proxy.ts` is the Next 16 middleware entry point (renamed from
  `middleware.ts`); it only refreshes the Supabase session.

## Environment

- Supabase: `lxaaclelfhjmqrhdqzxp` (`crave-and-create`, ap-south-1). **Both apps
  already share it** — true before this work started.
- 6 users total, 3 active in 30 days. `pro_subscriptions` is empty. No native
  binary has ever shipped. Consolidation is cheap right now.
- Migrations are plain `.sql` in `scripts/sql/`, run by hand. No migration tool.
- No test suite. `npx tsc --noEmit` + `next build` + screenshot diffs are the
  only automated gates.
- Both deployments live: `create-shop-crave.vercel.app` and
  `create-shop-crave-mobile.vercel.app/m`.
- `proxy-server/` contains only `node_modules` and is referenced by two env vars
  but zero source files — dead scaffold, safe to delete.
