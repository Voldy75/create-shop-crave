# Handoff — Crave & Create (web + mobile, unified)

Last updated: 2026-08-19. Written for a session with zero prior context.
Supersedes the two separate handoffs that lived in the web and mobile repos.

## Goal

One codebase, one backend, one design system serving a web app and a
Capacitor-wrapped iOS/Android app; plus an admin console that configures plans,
limits, and MCP providers at runtime instead of in code.

**On "the plan."** There is an original implementation plan at
`~/.claude/plans/let-s-revisit-so-far-proud-marshmallow.md` — but it is
**out-of-repo and stale** (dated 2026-08-01, so it predates all of Phase 10,
the artboard audit, and everything after). Treat it as HISTORICAL: useful for
the original reasoning, not for what is left to do. **This file plus
`MOBILE_SETUP.md` are the live source of truth for pending work** — start with
the consolidated index directly below.

## Pending work — consolidated index

Everything still to execute, most-blocking first. Each line points at the
section with the detail; this list is a map, not the territory. When you finish
something, update BOTH this index and the section it points to.

**A. Hard blockers — nothing ships past these, and they are all yours (no code)**
1. **Vercel env vars** — `ADMIN_EMAIL`, `NEXT_PUBLIC_ADMIN_EMAIL`, `RAZORPAY_*`,
   `STRIPE_*` (both projects); `SWIGGY_CLIENT_ID`, `NEXT_PUBLIC_SITE_URL` (web
   project). → "Blocked on you" §1–2. Unblocks Phase 5 cutover, payments, and
   the admin console (never once rendered).
2. **Supabase redirect URL** — add `com.cravecreate.app://auth/callback`. →
   "Blocked on you" §3. One minute; de-risks the highest-risk unverified path.
3. **Native toolchain + accounts** — toolchain is DONE for both platforms: iOS
   runs as a local DEV build in the Simulator, and Android's debug APK builds
   (JDK 17+21, Android SDK, `@capacitor/android`). **Still needed:** Apple +
   Play accounts, and running Android visually (emulator/device). → `MOBILE_SETUP.md`
   (the full ordered checklist). **Pin the Vercel alias FIRST — it is the only
   irreversible step, and every DISTRIBUTABLE build must regenerate `ios/` and
   `android/` against it (the current local ones are git-ignored localhost
   throwaways).**
4. **Google Maps key** — HTTP-referrer-restricted, falls back on mobile. →
   "Blocked on you" §5.

**B. Unbuilt / partial screens (real code work)**
5. **7e (link accounts) — DONE.** Built as mobile `/m/settings/connections`,
   which closed the LAST cross-root-layout jump: `/m/profile`'s Swiggy chip used
   to full-page-load into the web shell. Uses the real swiggy-client and the
   same feature flags web does. **7f (BYOK key entry) — DONE** (`/m/settings/key`).
   → 10f row in "Phase status", and the Flow 9 findings.
6. **6a animated splash** — needs the native shell (blocked on A3). **3a–3d /
   1i** (restaurant ordering) are out of scope by the design file's own note. →
   10f row.
7. ~~**The `/m/paywall` BYOK CTA is a dead end** and **`/m/chat` has no 429
   handling**~~ — **BOTH FIXED.** The paywall's "Use my own key" CTA now pushes
   to `/m/settings/key` (was `/m/profile`, which has no key field); `/m/chat`
   now reads the stored key into the request body and routes a 429 to
   `/m/settings/key?from=chat` (was silent). → "Two live bugs the audit
   surfaced".

**C. Verification gaps (built, not proven)**
8. **Admin console** — never rendered by anyone; needs `ADMIN_EMAIL` (A1).
9. **`/m/settings/notifications` (7c) + the 7d prompt** — verified signed-OUT
   only; the push/WhatsApp/test-send paths need a real session. → "What's
   actually next".
10. **`/m/log` on hardware** — viewfinder bug fixed and exercised via a
    synthetic stream; real permission/rear-camera/EXIF/iOS-autoplay still
    unproven. → the `/m/log` section, which carries the `--experimental-https`
    recipe.
11. **Dark mode** — the web screens are measured (see "Contrast: measure, and
    measure in BOTH themes"). The MOBILE tree has now been SPOT-MEASURED in dark
    across home / recipe / plan / paywall / connections, and there are real
    failures — see "Dark-mode mobile: measured findings" below. They split into
    app-level (fixable) and vendored-meshi-b (a design-system decision), which
    is why this is not just a screen pass. → that section.
12. **Any real payment**, on any provider. → "What is verified, and what is
    not" (PR #33 body).

**C-bis. Web redesign (w6a–w9e) — DONE, with two named gaps**
The new design file was implemented across 8 commits: see "The web redesign
against the NEW design file" below. Two things it could NOT verify and did not
fake: `NotificationsSection`'s real rows (no session — same wall as A1), and
anything behind a real ride booking or a real store order, which do not exist.

**C-ter. Three small gaps — DONE**
`favoriteCuisines` now reaches the prompts (soft signal, `lib/taste-prompt.ts`);
the sidebar account block is a real menu (`components/web/SidebarAccount.tsx`)
owning the theme toggle — previously unreachable once signed in — and sign-out.

**D. Content / decisions (cheap, pre-launch)**
13. **Unverified marketing copy** — "50+ cuisines", "<10s to a full recipe". →
    "What's actually next".
14. **The split product name** — "meshi" vs "Crave & Create". → 10d write-up,
    and `MOBILE_SETUP.md` §8.

**E. Deliberately deferred, its own piece of work**
15. **The `ai` v3→v7 SDK upgrade** (the remaining 14 npm advisories). → the
    "remaining 14" dependency section — do it with a real account available.

## Where the work lives

All of it is on **`merge/mobile-into-web`**, and every commit is **pushed** —
the branch tracks `origin/merge/mobile-into-web` and is kept in sync after each
piece of work. `main` is untouched at `ac8a8cc`, and both deployments still
serve the old code.

**Do not trust a SHA written in this file.** Two earlier versions of this
paragraph pinned one, both went stale within a few commits, and one of them
said "unpushed" long after the branch had been pushed — which cost a session
re-deriving the actual state. The invariant is what matters (branch in sync,
`main` untouched); for the specifics, run:

```bash
git status -sb && git rev-list --left-right --count origin/merge/mobile-into-web...HEAD
```

**"Pushed" is not "shipped."** Nothing here reaches a user until Phase 5 merges
to `main`. The branch existing on the remote only means it is backed up and
reviewable.

**There IS an open PR, [#33](https://github.com/Voldy75/create-shop-crave/pull/33),
and it is now marked READY FOR REVIEW.** It was a draft for most of its life —
opening a non-draft PR implies the branch is mergeable, and Phase 5 is still
blocked on env vars — but it was moved out of draft on an explicit user
decision so review can proceed. **"Ready for review" is NOT "ready to merge."**
The hard blockers in "Blocked on you" are still open, and the PR body's *Before
this can merge* section still governs: do not actually MERGE to `main` until
those are cleared. (If you want it back in draft: `gh pr ready --undo 33`.)

**No reviewers are requested.** The repo is a personal account with one
collaborator (the author), so GitHub has nobody to request — a human review
needs a collaborator added first (`gh api -X PUT
repos/Voldy75/create-shop-crave/collaborators/<user> -f permission=push`, then
`gh pr edit 33 --add-reviewer <user>`). The automated paths used instead are
`/code-review ultra` (done — see below) and Vercel Agent (user will enable it
on the Vercel project; it posts to the PR once Code Review is on and has run
against the head SHA).

Its body is kept in step with this file — it also carries the dependency
posture, the design-fidelity findings, and a **Post-review fixes** section.
**If you change something material on this branch, update the PR description
too**; it is the only thing a reviewer reads, and it drifted out of date once
already.

**It is currently IN STEP** (brought up to date after the post-review fixes).
It carries the coverage audit and its results, the ten screens that closed
those gaps (incl. 7f), the three things deliberately not built and why, both
live bugs fixed alongside them, a 10f phase row naming what is still open, the
note that the new notifications screen was only ever verified signed-out, and
the Post-review-fixes section recording the ultra review's clean verdict plus
the three low-severity fixes. If you change something material, it drifts again
— it has done so twice already.

**An `ultra` code review has been run on this branch and came back clean** — no
high- or medium-severity correctness bug confirmed across the auth/quota
chokepoints, billing, MCP registry/oauth, native bridge/push, the admin routes,
the SQL RPCs, and the modified chat/agent routes. It flagged three
low-severity sharp edges, all fixed in `db572fd`: a client-supplied base64
cursor interpolated into a PostgREST `.or()` filter in `/api/admin/users` (now
validated to strict UUID + timestamp before it reaches the filter); a
listener leak in `registerNativePush` (handles now removed on settle); and an
unhandled FileReader rejection in `/m/log`'s `onPick` (now caught → `setError`).

**Commit counts — do not be surprised.** `git log main..HEAD` returns **~88**
commits and still climbing; do not treat that figure as current either, count
it yourself. The itemized 14 below cover only through the merge
consolidation (`3910bc1`); everything after that is Phase 10 screen-by-screen
design work, then 10d/10e, then the dependency pass, then the artboard-coverage
pass (audit + nine screens, `2fd0ff8`), the `/m/log` camera-viewfinder fix
(`6ba913a`), the docs restructure (MOBILE_SETUP.md rewrite + the pending
index), then the mobile 7f BYOK key screen with the paywall/chat bug fixes
(`3709013`) on top of the `lib/byok` consolidation (`5a9c245`), and the three
post-review fixes (`db572fd`) — see the sections further down for that history
in detail, or `git log 3910bc1..HEAD --oneline` for the raw list. Of the original 35, only 14 were this work — the other ~21 were the
mobile repo's own history, which arrived with the merge and now lives in this
repo. That is the consolidation working as intended, not stray commits. The
original 14:

```
3910bc1 docs: bring handoff.md up to date across all phases
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
03174af Merge remote-tracking branch 'mobile/main'   ← brings the ~21
```

(`4498bd5` also exists on the local branch `chore/capture-rpcs-and-harden-db`;
it was cherry-picked here so source and DB stayed consistent. That branch is
redundant now.)

`npx tsc --noEmit`, `next build`, `eslint` and `npm run check:hex` are clean
(**77 routes** as of the w6a–w9e web redesign — `/home`, `/recipes`,
`/recipes/[slug]/cook`, `/dine-out` and `/dine-out/go/[id]` were added on top of
the 73 below; `/favorites` and `/settings/notifications` remain as redirects)
(**73 routes** — `/cart` was added during 10c, then `/m/plan/streak` and
`/m/settings/notifications` when the audit gaps were closed, then
`/m/settings/key` for the mobile 7f BYOK screen). Route counts quoted inside
the phase write-ups further down say 70 or 72 and are correct **as of those
phases** — they are historical verification records, not live claims. Do not
"fix" them.

**Database changes ARE already applied to production Supabase**
(`lxaaclelfhjmqrhdqzxp`) even though this branch is not merged. Schema and code
are therefore out of sync — the new tables exist and are simply unused by the
deployed app. Harmless today; worth remembering if anything else touches that
project before the merge.

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
| 9 native iOS/Android + IAP | code-level done. **BOTH platforms now build locally.** iOS runs as a DEV build in the Simulator (CocoaPods, `@capacitor/ios`, `ios/` generated, smoke-tested against `next dev`). Android's DEV **debug APK builds cleanly** (JDK 17+21, Android SDK, `@capacitor/android`, `android/` generated) — not yet run in an emulator/device. Both `ios/`/`android/` are git-ignored localhost throwaways. **Distributable builds are still blocked** on the alias pin + Apple/Play accounts; **IAP is still unbuilt**. See `MOBILE_SETUP.md` §4. |
| 10 meshi re-skin | **DONE — all of 10a–10e.** Mobile + web converted, mascot motion + brand assets shipped, `--cc-*` deleted (mechanical exit criterion verified zero), CI hex/rgba gate live. Real, tracked debt remains in screens with no artboard — see the 10e write-up below for exactly which. |
| 10f artboard coverage | **PARTIAL, and it is the honest successor to "10 DONE".** The code-by-code audit found the re-skin converted every ROUTE but left 12 of 37 artboard codes unbuilt. Nine are now closed (7a, 7b, 2a, 2b, 2c, 2d, 6b, 1l, 7c, 7d + the 7h fix), plus **7f** (BYOK key entry) built as mobile `/m/settings/key`. **Still open: 7e** (link accounts, web-only), **6a** (animated splash, needs the native shell), **3a–3d/1i** (out of scope by the design file's own note), **5a/7i** (dark mode). |

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

**4. Native toolchain — the full ordered checklist now lives in
`MOBILE_SETUP.md`.** Go there rather than working from this paragraph; it
carries the sequencing, which matters. Summary only:

**Both platforms are now buildable locally.** iOS: CocoaPods (1.17.0),
`@capacitor/ios` (committed), `ios/` generated and **run as a DEV build in the
Simulator** against a local `next dev`. Android: **JDK 17 + JDK 21** (21 is
required — Capacitor 7 plugins declare a Java-21 toolchain), the **Android SDK**
at `~/Library/Android/sdk` (via `android-commandlinetools` + `sdkmanager`,
licenses accepted), `@capacitor/android` (**installed and committed**,
`^7.6.8`, matching `@capacitor/ios`), `android/` generated, and the **debug APK builds cleanly**
(`./gradlew assembleDebug`) — not yet run in an emulator/device. Both `ios/` and
`android/` are git-ignored throwaways baking in localhost dev URLs
(`http://localhost:3000/m` for iOS, `http://10.0.2.2:3000/m` for the Android
emulator) plus dev-only cleartext exceptions, so both **must be regenerated
against the pinned alias before any distributable build** (item 1).

**Two things that paragraph used to get wrong, and are worth carrying here:**

- **IAP is not built, not merely unconfigured.**
  `@revenuecat/purchases-capacitor` is NOT in the dependency tree.
  `purchaseStoreProduct` in `lib/billing.ts` is a `TODO` returning
  `"unavailable"`, and `restorePurchases` is a deliberate no-op. This is
  compliant rather than broken — `canPurchase` is false on native so the
  paywall collapses to BYOK — but the app cannot sell anything on mobile.
- **Pinning the Vercel alias must happen BEFORE `npx cap add`**, and it is the
  only genuinely irreversible item in the project. See `capacitor.config.ts`'s
  own header comment, and item 1 of `MOBILE_SETUP.md`.

The icon/splash step is unchanged: `npm run gen:resources` then
`npm run assets`. The second pulls `@capacitor/assets` via `npx` instead of it
being a devDependency — see "Dependency advisories" for why. Nothing to install
first; npx fetches it.

**Watch two side effects of `npm run assets`** (both seen this session, both to
be discarded — they are not wanted changes): it rewrites `public/manifest.json`
to point the PWA icons at broken `../icons/*.webp` paths (mistyped `image/png`,
resolving outside `public/`), and it dumps a stray `icons/` dir at the repo
ROOT (not `public/icons/`). `git checkout -- public/manifest.json` and remove
the root `icons/` after running it. (Separately, `next dev` re-injects an agent-
rules block into `CLAUDE.md` on every run — also revert unless adopting it.)

**5. Google Maps key is HTTP-referrer-restricted** to the web domain, so the
map falls back on mobile and on localhost. Google Cloud Console allowlist fix, not code.

## Dependency advisories

`npm audit` went **43 → 14** and the only CRITICAL is cleared. What changed and
why is in the `chore(deps)` commit; the short version: **next 16.0.7 → 16.3.0**
(33 advisories on its own — middleware/proxy bypasses, SSRF in Server Actions
and rewrites, RSC cache poisoning, XSS, unauthenticated Server Function
disclosure), **react 19.2.0 → 19.2.8** (a patch, but it unblocked every
`audit fix`: `@ai-sdk/react`'s peer range has a gap at exactly 19.2.0, so
resolution was failing ERESOLVE), **sharp 0.34.5 → 0.35.3**, and
**`@capacitor/assets` removed**.

That last one is the interesting call. It is what carried the critical: it
bundles a stale `@capacitor/cli@5.7.8` with `tar@6.2.1`, plus
`@trapezedev/project → replace → minimatch@3.0.5` and its own
`sharp@0.32.6`. **None of those have an upstream fix — 3.0.5 IS the latest
release.** It is never imported by source; it is a one-shot CLI behind
`npm run assets`, which cannot run until `npx cap add ios/android` creates
native projects that do not exist. The script now calls it via `npx`, so the
native workflow is unchanged. **If you reinstate it as a dependency, the
critical comes back with it.**

Note the count mismatch: GitHub's Dependabot reported **118** alerts (46 high /
63 moderate / 9 low) against `main`, while `npm audit` here reports far fewer.
Two different things — Dependabot counts one alert per vulnerable *path* and is
looking at the unmerged `main` branch, npm audit dedupes by advisory on THIS
branch. Expect the Dependabot number to drop sharply, but not to match, once
this merges.

### The remaining 14 — deliberately not attempted

All fourteen have a single root: **`ai` is at v3.4.7 and the fix is v7** — four
majors. It is imported by six route files: `app/api/{chat,agent,coach,
ingredients}/route.ts`, `app/api/meals/analyze/route.ts` and
`lib/coach-insights.ts`, plus `@ai-sdk/react`'s `useChat` in the chat UI. A
v3→v7 jump changes the streaming API, the tool-calling contract and the
message format.

**This was left alone on purpose, and the reason is the risk profile, not the
effort:** there is no test suite, message-sending through `/api/chat` has never
been exercised end-to-end (it needs a real account — see the w3a notes), and
this branch carries 70+ unmerged commits. A blind four-major migration of the
core AI path, with no way to detect a regression, is a worse outcome than the
advisories.

**Their real-world exposure looks low**, which is why it can wait for a
deliberate pass rather than a rushed one — but "looks low" is not "patched":

- The two `high` items are `undici` and `nanoid`, both transitive through the
  SDK. Every high `undici` item is a **WebSocket client** issue
  (permessage-deflate decompression, `server_max_window_bits` validation,
  fragment-count bypass); `undici` is here as a fetch implementation and this
  app opens no undici WebSockets. The `nanoid` highs need a negative or zero
  `size`, which is SDK-internal and not attacker-reachable.
- The rest are moderate/low and all sit in the same SDK tree.

**Do it as its own piece of work**, with `ADMIN_EMAIL` and a real account
available so chat, the Swiggy agent, coach and photo analysis can each be
exercised after the upgrade.

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

### Screens rebuilt to artboards

**"16 of 16" is what this heading used to say, and that framing is the whole
reason the coverage gap went unnoticed for a phase** — it counted the app's
ROUTES against themselves, so it was trivially true and said nothing about
the 44 artboards. Read it as "every route that existed was converted", not
"the design is implemented". The code-by-code audit further down is the real
coverage picture.

| Flow | Screens |
|---|---|
| 1 Onboarding | welcome, location, diet, goal — plus **Meet Bo (7a), works-with-apps (7b), tastes (2b), calorie preview (2a), streak opt-in (2c), sign-in (2d), hand-off loader (6b)**, all added after the audit |
| 2 Home & discovery | Home, Discover (`/m/search`), Restaurants (incl. dine-in, 7h) |
| 3 Chat & recipes | chat, recipe |
| 4 Buy journey | buy, buy/platform, buy/confirmed |
| 6 Tracking | plan, plan/week, plan/diet-chart, **`/m/log`**, **`/m/plan/streak` (1l)** |
| 7 Saved & account | saved, profile, inbox, paywall |
| 9 Permissions | **`/m/settings/notifications` (7c)**, **bottom-up prompt (7d)** |

### Phase 10b (mobile) is COMPLETE

Every mobile ROUTE is built to its artboard — see the caveat above about what
that does and does not mean. The exit check:

```bash
grep -rn '#[0-9a-fA-F]\{3,8\}\|rgba(' "app/(mobile)" | grep -v 'mobile\.css'
```

returns exactly ONE line — `layout.tsx`'s `themeColor: "#FBF6E3"`, which is
Next metadata rather than CSS and cannot take a variable. Add it to DESIGN.md's
allowlist when the CI hex check lands.

They render and are navigable — tokens, fonts and layout are correct — but
carry white-on-dark treatments that read wrong on cream.

### Decisions taken during Flow 7 — and three live bugs it surfaced

**The paywall was making false claims.** All fixed, but understand why before
editing it:

- It **hardcoded `₹2,990` and `₹399`** while `plan_prices` says **₹749**. The
  screen advertised prices that do not exist. Prices now come from
  `fetchBillingOptions()` via `formatPrice`.
- `plan_prices` holds **one row per provider** (`₹749` razorpay / `$9` stripe
  for the same `pro` plan), so rendering every row showed two currencies side
  by side, both flagged "Best deal". Only `readyProviders[0]`'s rows are
  offers now.
- **Razorpay does not auto-renew.** `app/api/subscribe/razorpay/verify` grants
  exactly 31 days, one-time. The screen said "Cancel anytime · Auto-renews",
  which was simply untrue. The renewal note is derived from `interval` —
  `one_time` says so plainly.
- `startCheckout` was passed the literal `"pro"` for both tiers, so the user's
  plan choice never reached checkout.

**Artboard elements deliberately not built, because the feature does not exist:**

- Paywall's **"Start free week"** CTA and **"Rare mascots (yes, golden
  pineapple)"** bullet. There is no trial (checkout charges immediately) and
  mascot unlocks are still the open `.mascot-locked` question.
- Saved's **"Collections"** chip — no data model.
- Profile's **"recipes cooked"** and **"orders"** tiles — nothing tracks
  "cooked" and there is no order history table. Replaced with saved count and
  logging streak.
- Profile's **per-row unread dot** — `notification_log` has a delivery
  `status` but no read state, so a dot would be a fabricated unread count.
- Camera capture's **"Barcode"** mode and the live **"Detected: … 92%"** chip
  (see the `/m/log` note below).

**`chip-solid` was a dead class.** The inbox's selected filter used it; it is
defined nowhere, so the active filter looked identical to the others.
meshi-b's class is `chip-active`. Worth grepping for other invented class
names before trusting that a state "just doesn't show".

**Profile keeps Saved / Location / Swiggy entry points** even though artboard
1n has none — the tab bar has no Saved tab, so removing them orphans three
working routes.

### `/m/log` — camera meal logging (artboards 3e + 3f)

Previously deferred as "needs real backend work". It does not: `/api/meals/analyze`
is the same endpoint `components/planner/LogMealSheet.tsx` has been using on
web. One route, two phases.

- Web uses a real `getUserMedia` viewfinder; native uses the OS camera; both
  fall back to a file picker.
- **The viewfinder was COMPLETELY BROKEN and had been since it was written.
  Fixed — but understand the failure, because the shape of it recurs.** The
  `<video>` renders only when `liveCamera` is true, and the effect assigned
  `videoRef.current.srcObject` *before* calling `setLiveCamera(true)` — so the
  element did not exist yet and the ref was `null`. The assignment silently did
  nothing. Consequences, all of which fired on **every** device that granted
  permission:
  - the viewfinder was a black rectangle while the camera light was ON, because
    the stream was live and simply never attached to anything;
  - `video.videoWidth/Height` stayed 0, so the shutter's capture canvas was
    0×0, and **`canvas.toDataURL()` on a 0×0 canvas returns the 6-character
    string `data:,`** — which was POSTed to `/api/meals/analyze` as a photo,
    spending a quota-metered, server-paid model call on nothing.

  **Why no one caught it:** the preview browser always DENIES camera access, so
  every test run took the `catch` and landed on the file-picker fallback, which
  works fine. The success path had literally never executed. A denied
  permission was masking a total failure of the granted path.

  `srcObject` is now owned by a **callback ref** (`attachVideo`), which fires
  exactly when the node mounts, plus an explicit `play()` for iOS Safari — it
  does not reliably autostart a `srcObject` assigned post-mount even with
  `autoplay/muted/playsInline`. `shoot()` also refuses to send a frame when
  `videoWidth` is 0, and the shutter stays disabled until `loadedmetadata`.
- **The camera also never came back after a failed analysis.** `shoot()` calls
  `stopCamera()`, but the effect's deps are `[phase, mode]` and neither changes
  when analysis returns 401/quota/network — so the user was left on a dead
  viewfinder with no way back except toggling modes. `analyze()` now reports
  success and a `camNonce` dep forces a re-acquire on failure.
- **Verified with a synthetic `MediaStream`** (a real stream from
  `canvas.captureStream()`, so real tracks and real frames — only the source is
  fake). Before: `srcObject` absent, 0×0, `readyState` 0, capture `data:,`.
  After: stream attached, 640×480, `readyState` 4, playing, capture a real
  10.7KB JPEG; a failed analysis re-acquires the camera and leaves it live.
  **Still genuinely unverified on hardware** — real permission prompts, the
  rear-camera `facingMode` choice, orientation/EXIF, and iOS Safari's actual
  autoplay behaviour. See the real-device recipe under "What's actually next".
- **Manual mode is not in the artboards but is required.** `/api/meals/analyze`
  needs a session and is quota-metered, so without a no-AI path a signed-out
  user, or one over quota, could not log a meal at all.
- The Plan tab's old modal `LogSheet` was deleted rather than left as a second,
  divergent logging UI.

### The dark token pass DOES render

Previously "defined but never rendered". `crave_theme=dark` in localStorage
renders the whole mobile tree in dark; it looked correct on Saved and Profile
at a glance. It has still had no deliberate review — treat it as unverified,
not unbuilt.

### Decisions taken during Flow 4

- **The confirmed screen's stepper shows only `Placed`.** Artboard 4f draws
  `Shopping` as already in progress and calls itself a "real stepper", but
  nothing tracks order state — there is no order table and no platform reports
  progress back. Animating it would be telemetry theatre on the one screen
  where a user is actively waiting for information. `REACHED` is a single
  constant in the file: drive it from real data the day tracking exists and
  the visual is already correct.
- **`BuyList` (lib/mobile-handoff) is new and load-bearing.** The pre-check's
  deselection previously never left the screen — `/m/buy/platform` re-derived
  the list from the whole recipe, so skipping "butter" still put butter in the
  deeplink query and the estimate. If you touch either screen, keep the
  handoff intact or the pre-check becomes decorative again.
- **The Instamart card keeps an "or open Instamart yourself" deeplink** that
  artboard 4e does not have. Swiggy's MCP OAuth rejects our origin (Dead End
  1), so the agent path can fail for reasons the user cannot fix; without the
  fallback there is no way to reach Instamart at all.
- **Per-platform stock/price/ETA from the artboard is not built** — no
  platform exposes it to us. The only numbers shown are ones we computed.
- **`/m/buy` uses `height: 100dvh`, not `minHeight`.** With `minHeight` a long
  ingredient list grows the page and pushes the Continue bar — which carries
  the running total — below the fold. Same trap applies to any screen with a
  pinned CTA over a long list.

### Phase 10c (web) — what has landed, and the traps it hit

**The web artboards** are `Meshi Redesign - Web.dc.html` in the same Design
project. Nine boards: `wLa` full landing, `w1a` landing hero, `w1b` sign-in,
`w2a` home dashboard + shell, `w3a` Bo chat workspace, `w3b` recipe detail,
`w4a` cart, `w4b` tracker, `w5a` paywall. Extract them the same way as the
mobile ones — split on `<div class="dv-opt" id=`.

**`--cc-*` is now an ALIAS layer over `--m-*`, not a separate palette.**
Rewriting ~50 files at once would have been unreviewable, so every `--cc-*`
and shadcn token points at its meshi equivalent. Consequences to understand:

- The whole web tree changed palette in one edit, and each screen can now be
  restructured independently.
- **Dark mode came free and correct** — meshi-b defines `--m-*` light-first
  with a `[data-theme="dark"]` override, so the aliases track it. The web tree
  in dark renders `#241c10` on `#f4e8cf`, driven entirely by meshi.
- The old `[data-theme="light"]` token block and its rule overrides are
  DELETED. They repainted a dark-first system with literal hexes; light is now
  the base, so they either duplicated the base rule or actively fought it.
- These aliases are scaffolding. 10e deletes them.

**Traps hit, in order — do not rediscover:**

1. **Unlayered beats layered.** BOTH vendored stylesheets are unlayered, so
   ANY rule in `@layer utilities` loses to them regardless of specificity or
   source order. This has now bitten three times:
   - `.web-shell > .side { display: none }` lost to meshi-web's
     `.side { display: flex }` — the sidebar never hid.
   - `.band-deep .t-micro` lost to meshi-b's `.t-micro { color: ... }`, so an
     eyebrow on the plum band rendered ink-on-plum at 2.14:1 while carrying a
     perfectly good band-scoped text colour that never applied.

     A DOCS-LEVEL VERSION OF THE SAME TRAP: an earlier draft of this exact
     bullet quoted the literal Tailwind arbitrary-value syntax that used to be
     on that element. Tailwind's content scanner reads markdown too and
     doesn't know it was inside a backtick-quoted sentence describing a past
     bug — it compiled the quoted string into a real (and, the second time,
     build-breaking) utility rule. Two lessons, not one: quoting old
     class-shaped strings verbatim in prose can itself trigger the scanner,
     and the fix for that has to avoid the bracket-arbitrary-value shape
     entirely, not just alter what's inside the brackets — merely removing
     the leading `--` from a token name, which worked for the plain `--cc-*`
     mentions elsewhere in this file, was not enough here because the trigger
     was the surrounding
     Tailwind syntax, not the token name.
   - Chat's `.chat-input-bar { right: 336px }` and `.chat-rail`'s hide rule —
     same fix, same pattern, added straight to the unlayered block this time
     instead of losing an hour rediscovering the trap.
   meshi-b sets an explicit colour on `.t-micro/.t-cap/.t-body/.t-h1/.t-h2`.
   Any override of those, or of the shell, must sit OUTSIDE a layer — see the
   unlayered block at the bottom of `globals.css`.
2. **Turbopack serves a stale `globals.css` surprisingly often.** Three times
   now a compiled chunk kept an OLD value while other edits from the same file
   had compiled — `.glass-nav`, a whole new `.band-deep .t-micro` rule that
   was simply absent from the bundle, and chat's `.chat-input-bar { right }`
   reading `0px` instead of `336px` via `getComputedStyle` even after the
   source was correct. Every time a dev-server restart fixed it, and every
   time it looked exactly like a specificity bug. **Before debugging any CSS
   rule that seems not to apply, confirm it is in the served chunk:**

   ```bash
   curl -s http://localhost:3000/ | grep -oE '/_next/static/chunks/[^"]*\.css' | head -1
   ```
3. **`mm-bob` had no @keyframes rule anywhere in the web tree — Bo was
   static on every screen that used it, for three commits, and nothing in the
   verification process caught it.** meshi-b.css ships `mm-pop` and
   `mm-slideup` but not `mm-bob`/`mm-dot` — those exist only in the MOBILE
   tree's `mobile.css`, which `app/(web)` never imports. An `animation-name`
   pointing at an undefined keyframe is valid CSS that does nothing, silently
   — no console warning, no visual sign. Found only because the user asked
   where the how-it-works animations were, which prompted actually checking
   `document.styleSheets` for the keyframe rather than trusting that the
   `animation:` prop meant it worked. **If you port an artboard's `animation:`
   property, confirm the keyframe actually resolves in the target tree before
   moving on** — grep `mobile.css` isn't enough; check what the WEB tree
   loads.

   **This generalises beyond keyframes, and has now bitten twice.** The w5a
   paywall reached for `.on-plum` / `.on-plum-dim`, which are also mobile-only;
   unfixed, the pitch panel would have rendered chocolate ink on plum because
   meshi-b's `.t-body` sets an explicit colour and nothing overrode it. Same
   silence, same cause. **Any meshi class used on web needs checking against
   what `app/(web)/layout.tsx` actually imports** (`meshi-b.css`,
   `meshi-web.css`, `globals.css` — and NOT `m/mobile.css`). A quick check:

   ```bash
   grep -n '\.your-class' design/meshi-b.css design/meshi-web.css app/globals.css
   ```

4. **Forest bands work; the hero is not one of them.** `.section-dark` IS
   deep forest — wLa uses `--m-forest` full-bleed three times (stats strip,
   how-it-works, final CTA) plus `--m-plum` once. An earlier note here claimed
   the artboard had no dark band; that was wrong. What fails is putting a
   forest band behind the HERO, which holds the accent CTA and the accent
   headline word — both vanish. In wLa the hero is cream.
   To make a band work, **re-scope the tokens on it** rather than chasing
   rules: `.section-dark` redefines `--cc-text-*`/`--cc-accent` to their
   on-deep equivalents, the accent becomes LIME (forest is the band and cannot
   also be the accent), and cards on the band flip the scale back because a
   card is still a cream surface.
5. **Specificity: never flip band text with bare element selectors.**
   `.section-dark p` (0,1,1) outranks a Tailwind colour class (0,1,0), so a
   blanket `p, h1, h2, h3 { color: inherit }` turned every deliberately dark
   paragraph inside a card on the band cream-on-cream. Scope such overrides to
   utility classes.
6. **Breakpoints must match BottomNav.** The sidebar hides at `767.98px`
   because `components/BottomNav.tsx` uses Tailwind's `md:hidden` (768px). It
   was 900px first, which left 768–900 with no navigation at all. Verified at
   600 / 780 / 1280 — exactly one navigation at each.
7. **`app/global-not-found.tsx` needs `meshi-b.css` imported directly.** It
   renders outside both route groups and only had `globals.css`; with `--cc-*`
   reduced to aliases it rendered completely unstyled.
8. **The landing had 16 near-white text literals baked into Tailwind arbitrary
   values** — a `text-` colour utility per element, each holding a literal
   `rgba(250,249,247,0.68)`-shaped value. The light-first flip made them
   unreadable on cream. They are mapped onto the `--cc-*` text scale now, but
   the same pattern may lurk in other screens — grep before assuming a screen
   is theme-clean.
9. **The Browser-pane test harness has its own quirks — don't mistake them for
   code bugs, but don't dismiss real signals either.** All hit while verifying
   the landing and sign-in:
   - `scrollIntoView()` / hash-nav sometimes desyncs the harness's screenshot
     compositor — the page renders a blank flat colour even though JS reads
     correct layout and `opacity: 1`. `computer{action:"scroll_to", ref:...}`
     against an element ref from `read_page` was reliable every time raw
     coordinates or JS scrolling were not.
   - `read_console_messages` accumulates across the TAB's lifetime, not the
     current load — an old error (e.g. from a stale HMR cycle) keeps
     reappearing after a clean reload. A genuinely fresh `tabs_create` +
     `navigate` is the only reliable way to tell a live error from history.
   - Setting a controlled `<input>`'s `.value` via raw JS does not update
     React state — use `form_input` (dispatches real input events) for any
     field with an `onChange` handler, or the click on its submit button will
     see the old (empty) state.
   - The synthetic `computer{action:"hover"}` does not reliably register
     `:hover` (`element.matches(':hover')` stayed false at coordinates
     confirmed inside the element's bounding box) — hover-only CSS needs a
     real-cursor check outside this harness.

10. **"Converted to the artboard" did NOT mean "matches the artboard", and the
    verification method is what let that through.** Every 10c screen was
    checked by resolving tokens in the browser and measuring contrast — so
    colour was right everywhere — but **type WEIGHT and BUTTON CLASS were
    never compared against the source markup**, and both were wrong on the
    landing for the entire phase. The user caught it by eye, not the process.

    Two concrete faults, months old by the time they were found:
    - `.headline-hero` / `.headline-section` / `.headline-tile` were **600 and
      500** weight. Every display line in the web artboards is `font: 800`,
      and meshi-b's own scale agrees (`.t-d1`/`.t-d2` 800, `.t-h1`/`.t-h2`
      700, body 600). Those were General Sans values that the palette flip
      never revisited; at 600 Montserrat reads as semibold BODY, so every
      heading sat visibly light next to the design.
    - The landing's CTAs were the legacy `.btn-pill-*` — 400-weight, 17px,
      pressing with `scale()` — instead of meshi's `.pill-primary` /
      `.pill-secondary` / `.pill-lime` (+ `.pill-sm`), which are 700/16px,
      52px tall (38px sm), and press with the chunky `translateY` against a
      hard bottom shadow. Different height, weight AND motion.

    **When converting a screen, diff the artboard's literal declarations, not
    just its colours.** The design file spells them out: grepping an extracted
    artboard for the CSS `font:` shorthand gives you the whole weight/size
    inventory in one command, and the button classes are right there in the
    markup. (Written without a literal regex here on purpose — see the note
    about the content scanner in DESIGN.md.)

    Also worth knowing: tracking on display type is **px, not em**. wLa's hero
    is `-1.6px` at 56px; an em value re-tightens as a `clamp()` grows and
    starts colliding glyphs at the top of the range.

**Fabricated marketing content on the landing — RESOLVED.** The three
testimonials were invented quotes with invented names, made to look more
credible by the wLa conversion's carrot ratings and avatar discs. They are
**deleted**, replaced by an "at a glance" section in the reference layout
(centred headline, one wide photo, four fact cards) whose every value is
checkable in this repo: 6 platforms (`lib/deeplinks.ts`), 3 AI models
(`lib/providers.ts`), 2 countries, and the free tier's 2/day
(`plans.chat_daily_limit`). **The obvious version of that section is a scale
boast — users, orders, cities served — and that was deliberately not built:
this product has single-digit users and has never shipped a binary, so any
such number would be the same fiction the testimonials were.**

While there, the forest STATS band's claim of **"4 AI models … Gemini, GPT-4o,
Claude & Grok" was corrected to 3** — Grok is supported nowhere in the
codebase. The remaining STATS values ("50+ cuisines", "<10s to a full recipe")
are still unverified marketing claims and should be checked before launch.

**Sign-in has no dedicated route, and that is deliberate, not unfinished.**
Every "Sign in" trigger (nav, hero, both CTAs) opens the same modal on
`app/(web)/page.tsx`; unauthenticated visits to app routes redirect to `/`
(see `app/(web)/(app)/chat/page.tsx`'s `router.replace("/")`), never to a
`/signin` path. The w1b artboard draws sign-in as a full standalone page —
that became the modal's CARD content, not a new route. If a dedicated route
ever becomes worth building (deep-linkable, shareable), the card content in
`app/(web)/page.tsx`'s auth-modal block is already built to lift out wholesale.

**`OAuthProvider` is `"google" | "github"` only — Apple is not almost-there,
it is unsupported at the type level.** No Apple Services ID is configured in
Supabase either. The w1b artboard's "Continue with Apple" button is not
rendered anywhere. If Apple sign-in is ever wanted, it needs the type widened
in `lib/native-auth.ts`, a Supabase dashboard registration, AND — since native
sign-in already routes through the system browser — the same
`com.cravecreate.app://auth/callback` redirect entry blocker #3 above already
requires for Google.

**Magic-link email (`signInWithOtp`) is real, verified against the live
Supabase backend, but email DELIVERY is not verified.** Two addresses were
submitted through the actual form (an obviously-fake one, then one on the
reserved `.invalid` TLD) and both correctly surfaced Supabase's own validation
error — proving the call reaches Supabase and the response renders correctly.
What was deliberately NOT tested: sending to a real inbox, which would need
the project's email/SMTP configuration to actually be checked (same category
of gap as blocker 1's `ADMIN_EMAIL` — infrastructure, not code).

**`components/BottomNav.tsx` stays web-only, not deleted.** It is the
navigation below `md`, where the sidebar hides. The plan's "BottomNav becomes
mobile-only" meant it stops being shared with the `/m` tree, which it already
had.

### Designed screens with NO implementation (deferred by explicit decision)

Splash (animated Bo), Meet Bo intro, the mobile Buy 1 menu → 2 cart →
3 delivery → 4 tracking journey, notification bottom-up prompt, BYOK key
screen, dark-mode Home. The four-step ordering journey needs real backend
work, not just UI — there is no orders table and no platform reports state.

**This list was audited screen-by-screen against the design file and was
WRONG in both directions — read the audit section near the end of this file
before trusting any line of it.** Short version: it silently omitted four
boards that were never built and had no recorded reason (7a, 7b, 2c, 6b),
and it counts things as deferred that have since shipped.

Two entries left this list and the text above did not follow them, which is
worth stating so they are not "re-deferred" by a future reader:

- **camera capture and Bo's verdict (3e + 3f) ARE built** — `app/(mobile)/m/log`
  is one route with `phase: "capture" | "verdict"`. See the `/m/log` section
  above — including the `getUserMedia` viewfinder, which was found totally
  broken on the granted-permission path and fixed; only hardware-specific
  behaviour still needs a real-device pass.
- **A web cart exists** at `/cart` (artboard w4a) — but it is a shopping list
  with a subtotal and store hand-offs, NOT the mobile four-step journey and
  NOT a checkout. See the 10c entry for exactly what was and was not built.

### Decisions taken during Flow 3 — do not silently reverse

- **The recipe artboard's carrot rating was deliberately NOT built.**
  `RecipeData` has no rating field and nothing in the product collects one, so
  the artboard's "4.2 (154)" would be fabricated review data on a real screen.
  `components/mobile/CarrotRating` is built and used on Restaurants; wire it
  here the day ratings actually exist.
- **Artboard 7i (dark-mode dish detail) is deferred**, with the other dark-mode
  screens. The dark token pass still has never been rendered anywhere.
- **`lib/ingredient-mascot.ts`** maps an ingredient string to one of the 12
  produce mascots (Bo is never an ingredient). Keyword-first, then a
  deterministic hash — the hash matters, because a random pick would reshuffle
  the tile grid on every re-render.
- **The recipe servings toggle scales quantities AND per-row prices AND the
  total.** If you touch one, touch all three or the screen contradicts itself.
  Quantity scaling is anchored at the start of the string so "a pinch" and "to
  taste" pass through untouched.
- **Photo scrims live in `mobile.css`, not inline** (`.scrim-hero`,
  `.action-fade`, `.on-photo-soft`). DESIGN.md bans hex/rgba literals in
  `app/**` and `components/**` and does not allowlist photo overlays.
- **`react-hooks/set-state-in-effect` fires on recipe, chat, restaurants and
  both tracker screens alike.** It is the tree-wide pattern for reading the
  `sessionStorage` / `localStorage` handoff after mount — it cannot run during
  SSR. Pre-existing, not a regression.

### Decisions taken during Flow 6

- **`.row` + `.tint-*` needed a compound-selector override.** meshi-b declares
  the tints at line 72 and `.row` at line 144, and `.row` re-declares
  `background`. Same specificity, later wins — so `class="row tint-green"`,
  which the artboards use to mark today's row, rendered plain. Fixed in
  `mobile.css`, NOT in the vendored `design/meshi-b.css`, which must stay a
  faithful copy of the design source.
- **The Plan date strip is kept even though the artboard has no strip.** It is
  the only route to a past day. It parks scrolled to its end because
  `lastNDates` puts today last and today is the default selection.
- **Week bars scale to the goal, not to the tallest bar.** Bar height therefore
  means "how close to target"; scaling to the max would make every week look
  the same shape regardless of the goal.
- **The week average states how many days it covers.** "Avg 670 kcal" over a
  7-day chart with 3 days logged is a quietly misleading number.
- **The diet chart shows one row per day but keeps the per-meal data** behind a
  row expansion — the artboard's density without discarding real content.
- **Artboards 3e/3f (camera capture, Bo's verdict) remain deferred**, and
  **1l (streak & mascot unlocks) is blocked** on the `.mascot-locked`
  gamification question in the plan's open items. `loggingStreak` already
  exists and now feeds the Plan tab's flame chip, so 1l is mostly a
  product decision, not a data problem.

### Design system state

- `design/meshi-b.css` — shared tokens/components, consumed by both trees
- `design/meshi-web.css` — desktop shell layer, **imported by
  `app/(web)/layout.tsx`** (it landed with the 10c foundation)
- `design/meshi-motion.css` — mascot motion kit (10d), imported by BOTH root
  layouts. The only place `mm-*` keyframes should be added.
- `app/(mobile)/m/mobile.css` — mobile-only utilities meshi-b lacks
- `components/mascots/*` — 13 mascots + lookup map
- **BOTH trees are fully off `--cc-*`.** 10e deleted the alias layer; the
  mechanical exit criterion (`grep -rn -- '--cc-' app components`) returns
  zero. Do not reintroduce the prefix.
- **`--band-*` in `app/globals.css` is NOT leftover alias scaffolding.** It is
  a live, permanent mechanism: the landing's forest and plum bands re-scope
  text and accent by ancestor selector, because forest cannot be both the band
  and the accent on it. Deleting it makes the eyebrow and closing CTA
  invisible on two of the four band types.
- **Type weight and button class are the two things colour checks miss.**
  Display is 800 (meshi-b: `.t-d1`/`.t-d2` 800, `.t-h1`/`.t-h2` 700, body
  600); buttons are `.pill-primary` / `.pill-secondary` / `.pill-lime` with
  `.pill-sm` at 38px — never the legacy `.btn-pill-*`. See trap 10.

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
- **The orange is retired** in favour of forest green — **done repo-wide in
  Phase 10d**, including the four places CSS could not reach:
  `UpgradeDialog`'s Razorpay `theme.color`, `scripts/gen-resources.mjs` (which
  also stopped drawing a letter "C" and now draws Bo), the `assets` npm script,
  and `public/manifest.json`, whose PWA colours were found last and were still
  on the old palette. `resources/*.png` were regenerated in the same commit.

## Environment

- Supabase `lxaaclelfhjmqrhdqzxp`; both apps already shared it before this work.
- 6 users, 3 active in 30 days. `pro_subscriptions` empty. No native binary has
  ever shipped.
- Migrations are plain `.sql` in `scripts/sql/`, applied by hand. No migration
  tool.
- No test suite. The gates are `npx tsc --noEmit`, `next build`, `eslint`,
  **`npm run check:hex`** (the CI hex/rgba gate — `.github/workflows/
  design-tokens.yml`, baseline at zero) and browser checks. That is the whole
  safety net; there is nothing that would catch a behavioural regression.
- Both deployments still live and serving the OLD code:
  `create-shop-crave.vercel.app` and `create-shop-crave-mobile.vercel.app/m`.
- `proxy-server/` contains only `node_modules` and is referenced by two env
  vars but zero source files — dead scaffold, safe to delete.

## Suggested next step

**Phase 10 (the entire meshi re-skin, 10a–10e) is done, and so is the later
w6a–w9e web redesign** — for that, read "The web redesign against the NEW
design file" further down; the boards this section cites (w2a, w3a, w3b, w4a…)
no longer exist in the design file. What follows is kept
for its per-screen decisions and traps — read it if you're touching one of
these screens again — not as a live task list. For what's actually next, skip
to the end of this section.

1. **Finish 10c — the per-screen web conversions.** The foundation and the
   sidebar have landed (see the 10c section above). What remains is the actual
   screen work, and it is still the largest block of Phase 10:
   - **the topbar**, which could not land until each page's own sticky header
     was removed — that is why it was held back. It now ships per-screen, as
     part of the conversion that deletes that page's header: chat (w3a) and
     planner (w4b) both have it. Remaining pages still carry their own
     headers, so this stays open until they convert. **The 336px right rail
     is still per-screen too** — chat has one ("From this chat"); no other
     screen does, and w4b does not draw one;
   - ~~the landing page~~ — **DONE**, including the how-it-works mascot
     animations (mm-bob/mm-dot/mm-twinkle/mm-poploop/mm-deliver + hover
     micro-interactions). All 10 bands match wLa and the sequence is asserted
     in the browser. `.section-dark`/`.section-light` are gone, replaced by
     `Section tone="cream|cream2|forest|plum"`. See the 10c notes below for
     the traps — including a THIRD one found after this was first marked
     done.

     **Corrected LATER, after 10c was already closed** (trap 10 below):
     display weights were 600/500 instead of the artboard's 800, and the CTAs
     were the legacy `.btn-pill-*` rather than meshi's `.pill-*` — wrong
     weight, height and press animation. The nav was 48px with a bare-text
     sign-in; wLa is 76px with a `pill-secondary pill-sm` + `pill-primary
     pill-sm` pair. All fixed and measured against the source declarations.
     **wLa's centred Features / Recipes / Integrations / Pricing link row is
     still deliberately NOT built** — only two of the four have anywhere to go
     on this page and there is no pricing or public-recipes route, so it would
     be half dead links, the same call AppShell's sidebar made about Discover.

     **The testimonials section is gone**, replaced by an "at a glance" band
     (headline + one wide photo + four fact cards). See the "Fabricated
     marketing content" note below for what was and was not put in it.
   - ~~sign-in~~ — **DONE.** `components/AuthButton.tsx` + the landing's auth
     modal now match w1b's CARD (Bo circle, "Welcome back", provider stack).
     Stayed a modal, not a new route — see the 10c decisions below for why,
     and for what the artboard shows that was deliberately not built.
   - ~~chat~~ (`w3a`) — **DONE.** `app/(web)/(app)/chat/page.tsx`'s old sticky
     header (brand mark, avatar dropdown with Saved/Planner/Arena/Settings/
     theme/sign-out, usage badge) is replaced by w3a's topbar — this was the
     page the topbar work was held back for, since the sidebar (AppShell)
     already covers that nav. **Both gaps this note used to record are now
     CLOSED** — see `components/web/SidebarAccount.tsx`. `.side-acct` was a
     static display, so sign-out took an extra hop through Settings → Account
     and the theme toggle had no home at all in the logged-in app
     (`ThemeToggle.tsx` rendered only on the pre-auth landing). That block is a
     real menu now and owns both. Message bubbles, the typing
     indicator (Lottie stays for streaming; a real `.card`+`mm-dot` pulse
     backs pre-first-token loading), and the input pill are restyled onto
     meshi. A new "From this chat" rail tracks the most recent recipe live
     from `messages` and offers a real Instamart deeplink for its
     ingredients — not the artboard's "Missing 1 item" priced agent-cart row,
     which nothing on web actually computes (that is mobile-only, see
     `/m/buy`). The model picker shows the REAL active model (Gemini by
     default, or your BYOK provider) and opens the real `ApiKeyDialog` on
     click rather than faking a live switch — there is no in-place model
     switching in this product, and "Grok" is not a supported provider
     anywhere in the codebase, so it is not rendered (same category as
     sign-in's dropped "Continue with Apple"). Camera/mic icons from the
     artboard's input bar are also dropped — no attach or voice capability
     exists in `/api/chat` to back them. The Pro upsell price (₹749) was
     checked against `UpgradeDialog`'s real Razorpay amount before writing
     it, not copied from the artboard's stale ₹399 — the mobile paywall work
     found and fixed exactly that class of bug once already.

     **Two bugs found and fixed while building** (see the 10c traps below for
     the general pattern both belong to): the fixed input bar's `right-0`
     didn't know about the new rail, so its gradient background painted over
     the rail's bottom card and clipped the "Go Pro" button —
     `.chat-input-bar` unlayered override at the same 1100px breakpoint
     `.chat-rail` hides at fixed it. And the page root used `h-screen`, which
     used to be the true viewport root; nested inside AppShell's `.main` now,
     that sized against the full viewport a second time inside an
     already-constrained flex slot — changed to `h-full`.

     Verified: `tsc --noEmit` and `next build` clean (69 routes); eslint's 5
     findings confirmed identical to the unmodified original file via
     `git stash` comparison, plus one new instance of a "Compilation Skipped"
     category the original already had two of, unfixed — no new class of
     problem. Chat requires a real session, so verification used a
     **temporary, never-committed** local bypass of the auth redirect
     (confirmed removed via `grep` before committing) — checked at 1280 and
     375px: topbar, the real `ApiKeyDialog` opening from the model picker,
     empty-state greeting/suggestions, input, and the rail including the
     input-bar fix. **Message-sending itself was not exercised** — needs a
     real account, and touches unchanged `/api/chat` logic this pass didn't
     modify.
   - ~~recipe view~~ (`w3b`) — **DONE.** `components/RecipeView.tsx` and
     `components/RestaurantView.tsx`, both rendered inline in chat, are off
     Midnight Kitchen hex (were 12 and 21 hardcoded values respectively). The
     recipe card follows w3b: a `duo-forest` photo hero with time/kcal/
     difficulty badges and the title overlaid, a summary column with three
     pill actions (forest "I ate this" logs to the tracker, lime "Order ·
     ₹total" opens the Instamart agent flow, plum "Add to plan" — real
     equivalents of the artboard's Cook/Buy/Dine-out, since web has no `/m/buy`
     flow or dine-in booking to point at), then an ingredients card of mascot
     tiles (reusing `lib/ingredient-mascot.ts` from the mobile build) that
     double as per-item store links — collapsing what used to be two separate
     ingredient lists (a summary grid and a duplicate priced list) into one.
     `RestaurantView.tsx` has no dedicated web artboard, so it kept its
     existing map/carousel/sort structure and was tokenized in place: card
     shadows and the numbered-pin badge now use `--m-*`/`--m-shadow-lift`
     instead of orange-tinted rgba, the star rating uses `--m-orange` ("carrot
     / ratings" per DESIGN.md), filter chips use `var(--m-on-deep)` for active
     text, and the Google Map's dark Apple-style theme + marker pin (which
     was still drawing in the retired `#ff6b35`) is now a literal-hex-but-
     meshi-toned cream style with forest-green pins — literal hex stays
     correct here since it's Maps style JSON / an SVG data-URI, both allowlisted
     in DESIGN.md, but the retired orange had no excuse. Partner brand colours
     (Blinkit/Swiggy/Instacart/Zomato swatches, the Google-blue "you are here"
     dot) are untouched — allowlisted. Verified: `tsc --noEmit`, `next build`
     (69 routes) and `eslint` clean (2 pre-existing warnings, no new ones);
     rendered both components with sample data on a temporary,
     never-committed `/scratch-preview` route inside `(app)` (avoids the
     auth-redirect entirely rather than bypassing it) at 1280px — confirmed
     token colours resolve via `getComputedStyle` (forest/lime/plum pills,
     forest badges), all 6 ingredient tiles render mascot SVGs with correct
     per-store deep links, the store dropdown opens and switches brand
     colours, and all 3 sample restaurant cards render with working sort
     chips. **Not exercised**: the map itself (Maps key is
     referrer-restricted off localhost — pre-existing blocker 5, not this
     change) and the mobile carousel/IntersectionObserver path.
   - ~~tracker/planner~~ (`w4b`) — **DONE.** `app/(web)/(app)/planner/page.tsx`
     loses its own sticky header (back-arrow to /chat + title) for w4b's
     topbar — the same swap chat made for w3a, and the second of the two pages
     the topbar work was held back for. `TrackerView` is now the artboard's
     two-up (`.tracker-grid`: calorie ring + macros | week chart) over a
     full-width meals card. `CalorieRing` keeps SVG rather than the artboard's
     conic-gradient (same silhouette at 150/19, but an arc can animate and a
     conic-gradient cannot) and its centre now reads CONSUMED — "780 of 2,000"
     — with remaining as the headline beside it, so each number appears once.
     `MacroBars` moved onto meshi's `.progress` with the artboard's
     lime/orange/plum tones, matching the mobile plan tab's `Macro` helper so
     a nutrient is the same colour on both surfaces. `WeeklyChart` uses
     meshi-web's `.bar` and **scales to the goal, not the tallest bar** — the
     mobile week-screen decision, carried over so the same data doesn't tell
     two stories. `MealLogList` is flat and ordered by meal type (the artboard
     puts the type in the row title, which is the same information in less
     space; the per-group kcal subtotal goes because the ring already is the
     day total) with ingredient mascots standing in where there's no photo.
     **Artboard elements deliberately not built:** the topbar's SEARCH FIELD
     (it would have nowhere to go — Discover is /m-only, which is exactly why
     AppShell's sidebar omits it) and the bell's UNREAD DOT (`notification_log`
     has a delivery status but no read state, so a dot would be a fabricated
     count — same call the mobile profile row made). **Kept despite not being
     drawn:** the Goals gear (nothing else sets the targets every number here
     is measured against) and the week/month toggle (the month calendar is the
     only route to a day older than seven).
     `HistoryCalendar`'s intensity ramp was the last thing on this screen
     still painting the retired orange — it now ramps tint-green → lime →
     forest, with red still reserved for over-goal; it also returns bg and fg
     together instead of re-deriving the text colour by string-comparing the
     background, which broke silently the moment a value was edited.
     `.tracker-grid` is a NEW class rather than meshi-web's `.wgrid2`: the two
     cards stop being readable side by side around 900px, which is ABOVE the
     767.98px sidebar breakpoint, so reusing `.wgrid2` would have needed an
     unlayered override of a vendored rule (trap 1) instead of a new name.
     **`components/planner/` is now entirely free of hex/rgba literals** —
     all 13 files, including the four (`CoachPanel`, `AddToPlanDialog`,
     `DietChartPreview`, `PhotoCapture`) reachable from the other tabs; modal
     scrims use the `color-mix` on `--m-forest-2` pattern the landing's auth
     modal established.
     Verified: `tsc`, `next build` (69 routes) and `eslint` all clean with
     ZERO warnings. Driven in the browser at 1280 / 860 / 600 against seeded
     logs: ring arc resolves to `--m-forest` with a dash offset matching
     780/2000, macro fills are exactly lime/orange/plum-2, week bars are
     forest with lime for the selected day and `--m-red` for the over-goal
     one, the month ramp hits all four legend steps at the right thresholds,
     the two-up collapses to one column at 900 while the sidebar holds to
     767.98, the Plan tab's 1050px grid scrolls inside its own card rather
     than the page, and the new "Log now" row opens the sheet with **dinner**
     pre-selected. Fresh tab: zero console errors or warnings.
     **Not exercised:** actually saving a log through the sheet (the AI paths
     need a session and quota) and the Coach tab's generate calls.
   - ~~cart~~ (`w4a`) — **DONE, as a NEW `/cart` route**, and the one screen
     where the artboard was deliberately not followed on content. Read this
     before "finishing" it against w4a.

     **w4a draws a complete Instamart checkout that web cannot back.** Verified
     against the codebase, not assumed: there is no product catalogue (so no
     photos and no brands like "Fresho"/"Milky Mist"); `Ingredient.quantity` is
     free text ("½ cup", "1 ripe") so a −/+ STEPPER implies a unit that does
     not exist; delivery ADDRESSES live only inside the Swiggy MCP agent's
     `get_addresses`, which **Dead End 1** says rejects our web origin;
     `deliveryFee` and any tipping concept return **zero grep hits** in the
     whole repo, so the ₹49 delivery line and "Bo's tip jar" are pure
     invention; and there is no orders table and no platform reporting state
     back, so "Place order" and "Bo places & tracks this order for you" would
     be a button that cannot buy and a promise that cannot be kept. Building
     those is the same bug class the paywall already shipped once (₹2,990 /
     ₹399 against a real ₹749). **The user chose the honest version
     explicitly.**

     So the screen takes w4a's LAYOUT — item list + 336px summary rail — with
     only real data: ingredients from the same `mobile-handoff` BuyList /
     ActiveRecipe the mobile flow uses, mascot tiles instead of product photos
     (DESIGN.md's rule for ingredient-level tiles), INCLUDE/EXCLUDE rows
     instead of steppers (also the truer interaction — the real question is
     "do I already own this?"), a subtotal explicitly labelled an estimate
     with the note that the store settles prices and fees, and a rail that
     hands off rather than checks out. The Instamart card keeps a plain
     deeplink beside "Ask Bo to order" for the same reason `/m/buy/platform`
     does: Swiggy's OAuth can reject us for reasons the user cannot fix, and
     without the fallback there is no route to Instamart at all.

     Two knock-ons worth knowing: **`lib/pantry.ts` is new** — the pantry-staple
     heuristic was extracted from `/m/buy` so the two surfaces cannot diverge
     (a user deselecting "butter" on mobile and seeing it re-selected on
     desktop would reasonably call that a bug); it is still a keyword guess
     with no pantry table, so every row must stay togglable. And **"Groceries"
     finally joins the AppShell sidebar** — it was omitted only because it had
     no web route, which is now false. `.cart-rail` stacks below the list under
     1100px rather than hiding like `.chat-rail`, because this rail holds the
     total and the buy actions; hiding it would remove the point of the screen.
     `RecipeView`'s lime "Order · ₹X" now routes to `/cart` instead of straight
     to the agent, so the pantry pre-check happens BEFORE anything is ordered.

     Verified: `tsc` and `next build` clean (**70 routes** — `/cart` is the
     new one); eslint clean on every file except the pre-existing
     `set-state-in-effect` on `/m/buy`, confirmed identical via `git stash` to
     the untouched original. Driven at 1280/1000/600 with a seeded recipe: the
     pantry check correctly flags butter + garam masala and states the ₹60
     saving, deselecting chicken moves the total 390 → 210 with the chip, the
     skipped count and the strikethrough all staying consistent, and — the
     trap the BuyList note warns about — the store deeplinks contain **exactly
     the kept items with zero leakage** of the three deselected ones. The rail
     stacks full-width under 1100 with the CTA still visible and no horizontal
     scroll at any width. Fresh tab: zero console errors.
     **Not exercised:** the agent handoff itself (needs a session, and Dead
     End 1 means Instamart OAuth may reject the origin regardless).
   - ~~paywall/UpgradeDialog~~ (`w5a`) — **DONE, and it found three MORE live
     false claims** — the web dialog was in worse shape than the mobile paywall
     had been, because it never went through `lib/billing` at all and called
     the checkout endpoints directly:
     1. **"Pay ₹749/month via Razorpay" was wrong twice over.** The price was
        hardcoded, AND Razorpay is not monthly — `/api/billing/options` returns
        `interval: "one_time"` for it and `subscribe/razorpay/verify` grants
        exactly 31 days with nothing rescheduling it.
     2. **"Pay $9/month via Stripe" was hardcoded too**, and rendering both
        providers put ₹ and $ for the same plan side by side — the exact bug
        the mobile paywall had already fixed with `offersFor`.
     3. **"Cancel anytime. No hidden fees."** There is nothing to cancel on a
        one-time charge.
     All three now derive from `plan_prices`; the footer reads "One payment for
     31 days. Does not auto-renew." — verified against the LIVE API response
     (`74900 INR / one_time`), not assumed.
     **The artboard's numbers are stale and were NOT copied**: w5a draws
     "Yearly · ₹2,990" and "Monthly · ₹399" (neither exists in `plan_prices`),
     "7 days free" and a **"Start free week"** CTA — there is no trial, checkout
     charges immediately — and "All 4 models" when `lib/providers` has three.
     **`components/UpgradeDialog.tsx`'s Razorpay `theme.color` is off the
     retired orange** and onto `--m-forest`'s literal, which is the one
     DESIGN.md-allowlisted place a literal belongs (third-party iframe, no CSS
     custom properties). Checkout was the last user-facing surface still
     wearing the old brand. **`scripts/gen-resources.mjs` and `resources/*.png`
     deliberately still carry it** — flipping the generator without
     regenerating the PNGs leaves source and output disagreeing, which is worse
     than either state. Phase 10d does both as one task.
     **The paywall helpers now live in `lib/billing`** (`offersFor`,
     `intervalLabel`, `renewalNote`, `perMonth`, `PLAN_FEATURES`), shared with
     `app/(mobile)/m/paywall` — each encodes a correctness fix a paywall got
     wrong once, so duplicating them is how the two surfaces start quoting
     different terms for the same charge.

     **TRAP HIT — a THIRD instance of the `mm-bob` class of bug.**
     `.on-plum` / `.on-plum-dim` are defined ONLY in `app/(mobile)/m/mobile.css`,
     which `app/(web)` never imports. Using them on the plum pitch panel
     without redefining them would have left the text at meshi-b's
     `.t-body { color: var(--m-ink) }` — chocolate ink on plum, unreadable, and
     silently so. Web equivalents are now in globals.css's unlayered block
     (unlayered because meshi-b sets an explicit colour on `.t-body`/`.t-cap`,
     and globals.css is imported AFTER meshi-b so equal specificity wins on
     source order). **Before using any meshi class on web, confirm the WEB tree
     actually loads it** — grep `mobile.css` is not enough.

     **A second bug was introduced and caught during verification:** an inline
     `overflow: hidden` on the card beat `.paywall-card`'s `max-height` +
     `overflow: auto`, so on a short viewport the CTA was clipped out of reach.
     Removed; confirmed at 680×420 that the card scrolls and the CTA is
     reachable.
     Verified: `tsc`, `next build` (70 routes) and `eslint` clean with zero
     warnings. Rendered against the live billing API on a temporary,
     never-committed `/scratch-paywall` route (removed — `grep` confirms no
     scratch route remains): one offer not two, "One payment · ₹749",
     "Get meshi+ · ₹749", the correct non-renewal footer, BYOK as a real third
     row with working provider chips, stacking to one column at ≤720px, and
     contrast on the plum panel measured by compositing alpha over the
     background — **9.9:1** for the headline and features, **6.95:1** for the
     sub-copy, both above AA. Fresh tab: zero console errors.
     **Not exercised:** an actual purchase — Razorpay/Stripe checkout needs a
     session and real keys, which blocker 1 says production has never had.
   - ~~`components/cc/*`~~ — **DONE. All six reskinned; none deleted, because
     all six are still imported** (button ×5, status-pill ×6, chip ×3, card ×3,
     section and icon-badge ×1). `components/cc/` now greps **zero hex/rgba**.

     **A LIVE BUG was found and fixed in `chip.tsx`.** The active state emitted
     `class="chip active"`, and a bare `.active` rule exists in NO stylesheet
     the web tree loads — meshi-b's class is `.chip-active`. The selected chip
     rendered identical to the unselected ones, so the admin users page's
     Status and Platform filters both looked permanently unfiltered. **This is
     the same failure as the `chip-solid` bug the mobile inbox hit** — an
     invented class name is valid HTML that silently styles nothing. It went
     unnoticed because the only consumer passing `active` is the admin console,
     which per blocker 1 nobody has ever rendered. Verified fixed by measuring
     that the two states now differ (lime `.chip-active` vs card).

     **`status-pill.tsx` needed a real contrast fix, and the naive one was
     wrong.** The label is 10px, so AA wants 4.5:1. The old iOS colours on 10%
     tints failed in light mode (burnt 3.43, red 3.15, ink-soft 4.16). But
     darkening to each hue's dark sibling then failed in DARK mode — `--m-forest-2`
     and `--m-brown` are dark in BOTH themes, measuring 1.80 and 2.36 on a dark
     surface. The fix is uniform: **`hue 50% + --m-ink` on an 18% tint of the
     same hue**, which works because `--m-ink` is chocolate in light and cream
     in dark, so text lightness tracks the theme by construction. Measured
     across all 8 combinations — light 7.30 / 5.36 / 10.46 / 5.38, dark 6.03 /
     6.71 / 12.39 / 6.04. **Retuning these needs a re-measure in BOTH themes.**

     `button.tsx` keeps its sm/md/lg scale rather than becoming `.pill-primary`
     — that class is a 52px hero pill, wrong for a dense admin table — but
     takes meshi's chunky sticker press (translateY against a hard bottom
     shadow) in place of the old active-state scale transform, plus `--m-red`
     for destructive.
     `card.tsx` deliberately does NOT adopt meshi-b's `.card` class, because
     `.band-deep .card` re-scopes text tokens for the marketing bands and would
     drag landing behaviour into the admin tree; it takes the surface tokens
     only. `icon-badge.tsx` moves to the tint-green/forest pairing that
     `.tab-active .tab-ic` already uses.

     **`section.tsx` deliberately still names `--cc-accent`, and it must.** It
     is the one place the alias layer is load-bearing: `.band-deep` re-scopes
     `--cc-accent` to LIME on the forest and plum bands, because forest cannot
     be both the band and the accent on it. Hardcoding `--m-forest` would make
     the eyebrow invisible on two of the landing's four band types. **10e must
     move the band mechanism in globals.css to a scoped `--m-*`-named variable
     BEFORE deleting `--cc-*`** — this is not a stray alias to sweep up.

     Verified: `tsc`, `next build` (70 routes) and `eslint` on `components/cc/`
     all clean with zero findings. The 4 findings in admin/settings consumers
     are pre-existing — confirmed identical with the cc changes `git stash`ed.
     All six rendered with every variant on a temporary, never-committed
     `/scratch-cc` route (removed; `grep` confirms none remain), computed
     styles checked against the meshi tokens, and contrast measured in both
     themes. **Caught during this pass:** the icon-badge rewrite initially
     dropped its `<Icon />` render and would have shipped empty badges.
   **10c is complete.** The "every web page is phone-width inside a 1280px
   shell" gap that headlined this list is closed: the sidebar, the per-screen
   topbars, `.tracker-grid`, the chat and cart rails, and the paywall's two-up
   card all lay out for desktop now.

   Still WEB-ONLY-shaped, and worth naming so nobody assumes otherwise:
   `/settings`, `/favorites` and `/arena` were never converted to an artboard —
   there is no web board for them. They inherit the shell and the aliased
   palette, so they are on-brand, but they are not *designed*. The admin
   console is the same, plus it has never been rendered by anyone (blocker 1).
2. ~~**Phase 10d**~~ — **DONE.** Two halves:

   **a) The mascot motion kit.** `design/meshi-motion.css` is new and vendored
   from "Meshi Mascot Animations.dc.html" — 15 keyframes, per-move utilities,
   and a per-character idle class for all 13 mascots. It is a SEPARATE file
   because DESIGN.md requires `meshi-b.css` to stay a faithful copy of the
   design system's own file, and these keyframes come from a different design
   document. Both root layouts import it, so it is shared by construction.
   `lib/mascot-motion.ts` maps `MascotName` → idle class (plus a stagger
   helper), so callers ask for "the carrot's move" rather than remembering it
   is a 1.6s wiggle around a 50%/88% origin.

   **This consolidated a real divergence.** `mm-bob` was defined byte-identically
   in BOTH `globals.css` and `mobile.css`; `mm-ring`/`mm-blink` were mobile-only
   duplicates of the doc. Those are gone, replaced by the shared file. **`mm-dot`
   was worse — the same name animated two different ways depending on which tree
   you were in** (web: the doc's 11px hop; mobile: a 4px hop with an opacity
   fade, tuned for the 8px dots of Bo's thinking bubble). That is the `.row`
   mistake again. The mobile variant is now `mm-dot-soft`, local to `mobile.css`,
   with its one consumer updated; `mm-dot` means exactly one thing repo-wide.
   Landing-only compositions (`mm-twinkle`/`mm-poploop`/`mm-deliver`/`hiw-in`)
   deliberately stay in `globals.css` — they are not part of the mascot kit.

   Applied so far, deliberately sparingly: the paywall's mascot trio (three
   different moves, so it reads as characters not a wave) and the cart empty
   state. **Note a static `transform: rotate()` and an idle move cannot share
   an element** — every move animates `transform` and simply overwrites it. The
   paywall puts the tilt on a wrapper; do the same elsewhere.

   **b) The orange is gone from the entire repo.** Beyond the Razorpay
   `theme.color` already fixed in w5a: `scripts/gen-resources.mjs`, the `assets`
   npm script, and — **found during this pass, and live** — `public/manifest.json`,
   whose PWA `theme_color` was still `#ff6b35` and `background_color` still the
   Midnight Kitchen `#0f0f0f`. Both are now cream, matching
   `app/(mobile)/layout.tsx`'s `themeColor`.
   The generator also stopped drawing the letter **"C"**: the mark is Bo now,
   with path data copied verbatim from `components/mascots/BoBowl.tsx` so the
   icon and the in-app mascot cannot drift. `resources/*.png` were regenerated
   and committed in the same change — **they are build output; never change the
   generator without re-running it**, or source and output disagree.

   **One thing to decide (not a blocker):** the product NAME is split. The mobile
   layout titles itself "meshi — Crave & Create", the web layout and
   `public/manifest.json` still say "Crave & Create", and the design system is
   "meshi" throughout. The Razorpay descriptor now names BOTH deliberately —
   a statement line reading only "meshi" is an unrecognised descriptor and a
   chargeback risk — but a real rename is a product call, not a design cleanup,
   so nothing else was touched.
3. ~~**Phase 10e**~~ — **DONE. All of Phase 10 is now complete.** Two halves:

   **a) `--cc-*` is deleted.** `grep -rn -- '--cc-' app components` returns
   zero — verified as the LITERAL mechanical criterion, not just "no CSS
   variable references": the alias `:root` block, both `.band-deep`
   re-scoping blocks, and every historical comment mentioning the old prefix
   are gone or reworded. **A real prerequisite had to land first**: the
   landing's forest/plum bands were re-scoping `--cc-text-secondary` /
   `--cc-accent` etc. by ancestor selector so text and the accent stay legible
   on a saturated ground (forest cannot be both the band and the accent on
   it) — deleting the alias wholesale would have deleted that mechanism too,
   silently breaking the eyebrow and the closing CTA on two of the landing's
   four band types. It now has its own honestly-named, permanent tokens
   (`--band-text-secondary`, `--band-text-tertiary`, `--band-border-strong`,
   `--band-accent`, `--band-accent-hover`) — **not** part of the retired
   vocabulary, don't delete these in a future cleanup. `components/cc/
   section.tsx`'s eyebrow and `.btn-pill-primary`'s background/hover are the
   two live consumers; both verified in the browser resolving to `--m-lime` /
   `--m-forest-2` on the forest CTA and holding at `--m-forest` everywhere
   else, in both themes.

   The other ~800 call sites (36 files) were a straight mechanical rename —
   `var(--cc-accent)` → `var(--m-forest)`, etc. — using the exact 1:1 map that
   used to live in the deleted `:root` block. `--cc-radius-sm` had no `--m-*`
   equivalent (it was a bare `10px`); it had zero real consumers, so nothing
   to inline.

   **TRAP HIT, twice, both self-inflicted this pass.** First: a CSS comment
   containing a literal `--band-text-*/--band-accent` — meant as shorthand for
   "either token" — has a `*/` inside it, which is COMMENT-CLOSE in CSS. No
   nesting, no escaping. It silently ended the comment early and left prose
   as invalid CSS; build failed with a real syntax error, not just dead
   output. Second, worse: quoting an old Tailwind arbitrary-value class
   verbatim in prose in handoff.md and DESIGN.md got picked up by TAILWIND'S
   CONTENT SCANNER, which reads markdown and comments repo-wide, not just live
   JSX. It compiled the quoted strings into real utility rules; one of them
   held an ellipsis standing in for "some value", which is not valid CSS
   inside a custom-property reference, so that one was a hard, build-breaking
   parse error too — found only via a
   **genuinely fresh tab** (`fetch` with `cache: 'no-store'` on the actual
   served CSS chunk after an `rm -rf .next`), because Turbopack kept serving
   the last-good chunk over HMR and made the page look fine while the
   underlying build was broken. **When quoting an old class name in prose
   anywhere in this repo — code comments, handoff.md, DESIGN.md — never
   reproduce the bracket-arbitrary-value shape at all**, even inside
   backticks. Describe it in words instead. (This paragraph is written to its
   own rule; an earlier draft of it quoted the offending strings verbatim and
   became a third instance of the trap it documents.)

   **b) The CI hex/rgba gate is live** — `scripts/check-hex.mjs` +
   `.github/workflows/design-tokens.yml`, running on any PR touching
   `app/**`/`components/**`. Two exemption mechanisms, matching two different
   realities:
   - **Permanent, DESIGN.md-allowlisted literals** (Razorpay's `theme.color`,
     both Google Maps style-JSON files, the SVG data-URI marker pin, partner
     brand colours in `RecipeView`/`ConnectionsSection`/`AuthButton`, the one
     `themeColor` metadata field) get an inline `// hex-ok: <why>` or a
     `// hex-ok-start` … `// hex-ok-end` block marker, added to every one of
     these this pass.
   - **Real, temporary debt** — 90 lines across the screens Phase 10c never
     had an artboard for (admin console, `/favorites`, `/arena`, `/settings`
     + its three sections, `FavoriteButton`, `SwiggyExpiryBanner`,
     `UsageBadge`) — is recorded in `scripts/hex-baseline.json`. The gate
     won't newly fail on these, but the baseline is a ratchet: converting one
     of these files should shrink it, and `--write-baseline` must never be
     run to silence a genuinely new violation. **Verified the gate actually
     gates**: added a throwaway `#123456` to a tracked file, confirmed the
     script exits 1 and names the exact line, then removed it and confirmed a
     clean exit — this was tested behaviorally, not just written and trusted.

   Verified beyond the above: `tsc`, `next build` (70 routes) and `eslint`
   clean on every touched file, confirmed identical to the last commit via
   `git stash` (17 pre-existing findings, unchanged count). Fresh-tab console
   clean on `/`, `/m`, and `/m/restaurants` (the last shows the pre-existing,
   documented Maps-referrer-restriction error only). Dark mode spot-checked
   on the forest CTA — lime stays lime, text tracks `--m-forest-2`'s own
   per-theme value, no hardcoding needed. The 4.05:1 contrast on the STATS
   band descriptions and 1.7:1 on the "01/02/03" ghost numerals were
   double-checked against the last commit's source and are byte-identical
   pre-existing values from Phase 10c's original band design — not introduced
   here, and out of scope for a token-rename pass to silently "fix".

## The web redesign against the NEW design file (w6a–w9e)

**Read this before touching any web screen.** The design file was REPLACED, not
extended. `Meshi Redesign - Web.dc.html` no longer contains `w1b, w2a, w3a,
w3b, w4a, w4b, w5a` — the nine boards Phase 10c was built against. It now holds
15: `w1a, wLa, w6a, w7a/b/c, w8a–w8d, w9a–w9e`. Anything above that cites w2a
or w3a is describing a board that is gone; those codes now only name
already-shipped screens.

**`design/meshi-app.css` is new and load-bearing.** NONE of the new boards'
component classes existed anywhere in this repo — not in meshi-b.css,
meshi-web.css, globals.css, nor even mobile.css. `.dchip`, `.dpin`, `.ingr`,
`.utab`, `.xsw`, `.xrow`, `.xcell`, `.xmeal`, `.thr`, `.dnc`, `.rideo`, `.bkw`,
`.din-*` and the `din-*/rt-dash/bk-pop` keyframes are all vendored there, in a
separate file for the reason meshi-motion.css is one. Imported by
`app/(web)/layout.tsx` after meshi-web.css, unlayered.

**What was deliberately NOT vendored, and why it matters:** the ~66 CSS-only
state rules. The artboards are static HTML, so every interactive state runs on
a hidden `input.x-in` plus `:has(…:checked)`. React drives state for real, so
what is ported is the *rendered appearance* of each `:checked` branch as an
`.is-*` modifier the component applies. **If you reach for a `:has()` rule from
the artboard and cannot find it, that is why — use the modifier.** The
vocabulary is listed in that file's header. Also not ported: the `.win*` fake
browser chrome, and `.mlabel` (the real Google Map draws its own place labels;
a second invented set would be fabricated geography).

**A trap this pass hit twice, in both directions.** `.xhost` and `.svit/.svon`
went into markup before anyone noticed they are state hooks that were never
vendored — invented class names that are valid HTML and style nothing, exactly
like `chip-solid` and `class="chip active"`. There is now a mechanical check
worth re-running after any artboard port:

```bash
# every artboard-shaped class used in the app, vs what the web tree loads
grep -rhoE 'className="[^"]*"' app components | tr ' ' '\n' \
  | grep -oE '\b(x|d|ing|stp|thr|utab|bkw|sv|mp-|rideo|pseg|dseg|dchip|dpin|dnc|rcard|din-)[a-z0-9-]*' \
  | sort -u | while read c; do grep -q "\.$c" design/*.css app/globals.css || echo "UNDEFINED: .$c"; done
```

The only legitimate misses are `.ing-name` / `.ing-qty`, which are mobile-only
and used only in the mobile tree.

### New routes

| Route | Board | Notes |
|---|---|---|
| `/home` | none (w2a is gone) | Signed-in dashboard. `/` stays the landing; it used to redirect signed-in users to `/chat`, so the sidebar's "Home" pointed at a page that bounced them out. Composed from the system + the mobile home, NOT traced. |
| `/recipes` | w9a | The saved shelf. `FavoriteButton` already wrote favorites from chat; this is the missing surface. `/favorites` is now a redirect here. |
| `/recipes/[slug]/cook` | w9b | Tickable ingredients/steps, servings stepper. Slug resolves via the sessionStorage hand-off first, then the saved shelf — so it is NOT a durable permalink, and has a real not-found state. |
| `/dine-out` | w9e + w7c | ONE route, two view modes. w9d/w9e/w7c all print the same fake URL, so they are three treatments of one screen. |
| `/dine-out/go/[id]` | w9c | The most heavily trimmed screen in the project — see below. |

`/settings/notifications` is now a **redirect** onto `?tab=notifications`; it
was a full 952-line second copy of the notifications UI. It **forwards its query
string**, because `/api/swiggy/auth/callback` lands there with `?connected=1`.

### What these boards draw that is NOT built

The rule agreed for this work was honest data only, and it removed a lot:

- **Ride fares, and the whole booking flow.** w9c draws nine priced tiers, a
  "Confirm ride · ₹212", then a named driver, his rating, a plate, an OTP,
  "Arriving in 3 min", and "your 8:30 table is held". This app calls no rides
  API, cannot book a ride and cannot hold a table. Mobile 7h already made this
  call for fares. What IS real: the route, haversine distance, an approximate
  drive time labelled as such, and real Uber/Ola/Maps deeplinks.
- **Rapido** — no deeplink builder and no public scheme to write one against.
  A `.mp-rapido` style exists but nothing renders it. Same call as "Grok".
- **Match scores** (92%/84%/79%). Nothing computes dish↔restaurant similarity;
  Bo returns an ordered list, so rank is real and rank is shown.
- **Per-restaurant dish names and prices** — no platform gives us a menu.
- **w9a's editorial feed** ("monsoon dinners", "Show 24 more", four Collections
  cards with counts) — no catalogue, no collections model. The hero and grid are
  filled from the user's own shelf.
- **w9b's timer and hands-free mode**; **w9a's "cooked twice"**.
- **w8b's "₹2,990 · renews 14 Mar 2027"** — the real product is ₹749 once for
  31 days. Use `lib/billing`. This is the third time a paywall number in a
  design has been wrong.
- **w8a's "History synced · kept 90 days"** — the window is 3 days and
  localStorage does not sync. Both halves false.
- **Pantry state from "Tuesday's Instamart order"** — there is no order history;
  it is `lib/pantry.ts`'s keyword guess, and the copy says so. Do not reword it.

### Retention: three short-lived stores

`lib/history-store.ts` is a small `HistoryStore<T>` with prune-on-read (a timer
cannot run while the tab is closed, which is when most ageing happens; `list()`
writes the pruned set back, so it self-heals). Screens talk to the interface,
never to localStorage, so the agreed "Supabase later" swap stays free.

- `lib/conversation-history.ts` — Bo threads, **3 days**. This finally wires up
  what `lib/storage.ts`'s `ChatSession` block never did (zero callers); that
  dead code is deleted.
- `lib/grocery-history.ts` — **7 days**, and note the naming: it records what
  was **SENT** to a store, never "bought". No platform reports a completed
  order back. Every label says "sent". Do not "improve" this into a purchase
  history.
- Saved recipes stay untimed in `lib/storage.ts`'s favorites.

### Chat: the rail is now quick-action-triggered

The rail used to open itself whenever a reply happened to contain a recipe, so a
336px column appeared and vanished as you talked. It is closed by default and
opens on a quick-action chip under Bo's newest answer. Consequence:
`.chat-input-bar`'s 336px inset can no longer be a pure media query — the page
sets `.chat-has-rail` on the flex parent so the two cannot disagree.

Two real gaps closed alongside: the rail had **no restaurant branch** at all
(`latestData` could match a restaurantSuggestion and only the recipe path
rendered), and the topbar's new-chat button cleared `messages` without starting
a new THREAD, so the next reply overwrote the thread you were reading.

### The map: one implementation, and two blank-map bugs

`components/web/MeshiMap.tsx` is now the only Google Map in the web tree;
`RestaurantView` delegates to it through its existing `RestaurantMap` wrapper.
Every load-bearing piece is unchanged — same loader id (`crave-create-maps`; a
second id loads the script twice), `fitBounds`, `panTo`, the `gm_authFailure`
hook and both fallbacks. Pins are `OverlayViewF`, not `Marker` icons, so they
can use the real mascot components instead of copying path data into an SVG
data-URI (the `gen-resources.mjs` drift risk).

**Both bugs render a silent blank rectangle, which is why they lasted:**

1. Dropping the `apiKey &&` guard before mounting the loader. `useJsApiLoader`
   with an empty key does not error — it settles into a state that renders
   nothing. Guard restored.
2. **Pre-existing:** `gm_authFailure` works (invoke it and the Embed iframe
   takes over) but Google does not always call it. A referrer-restricted key on
   localhost logs `RefererNotAllowedMapError` and renders nothing. That is the
   state this project's key is in off its web domain (blocker 5), so it is what
   every developer sees. There is now a guard: if the container is still empty
   2.5s after load, fall back.

### Contrast: measure, and measure in BOTH themes

Two failures this pass introduced, both caught only by measuring:

- **Brand chips.** The boards pair every `.mp-*` ground with white text, as the
  brands do. At 13px/700 that is 2.55:1 on Swiggy orange and 2.80:1 on Ola
  green. The ground stays the brand's (that is what makes a chip
  recognisable); the ink moved. All seven now clear AA, worst case 4.59. The
  winning ink is **not uniform** — white stays correct on Uber and on the
  directions blue.
- **The dashboard's big kcal number.** `--m-forest` is 8.03:1 on light and
  **2.63:1** on dark. The obvious fix — `color-mix(--m-forest 50%, --m-ink)`,
  copying `status-pill.tsx` — made it **worse (1.51:1)**, because `--m-ink` is
  cream in dark so the mix lands on the card; status-pill works because its
  ground is a tint of its own hue, not the card. The real fix is
  `--figure-accent` in globals.css: forest on light, lime on dark. 8.03 / 7.5.
  **It is permanent** — deleting it drops that number back to 2.63:1.

### Verification notes for this work

`tsc`, `eslint`, `npm run check:hex` (still zero) and `next build` are clean;
**77 routes**. Two permissions are DENIED in the preview browser and both can
mask a broken granted path — the `/m/log` camera lesson:

- **Geolocation.** Both branches were exercised: signed-out renders "Set your
  location to get routes and rides" instead of dead buttons and hides the
  Nearest sort; the granted branch was checked behind a temporary, never-
  committed seeded location in UserContext.
- **Auth.** Chat, settings and the dashboard were driven behind a temporary,
  never-committed redirect bypass. `grep -rn "TEMP-VERIFY" app components lib`
  is clean; re-run it if you use the same technique.

**Still NOT exercised:** `NotificationsSection` renders "Sign in to manage
notifications" without a session, so its real `.xrow`/`.xsw` rows have never
been on screen — the styling CONTRACT was verified by mounting both states and
measuring (off: cream-2 track, knob at rest, detail `display:none`; on: lime
track, knob translated exactly 26px, lime 2.5px ring, tint-green icon), but the
behaviour behind the toggle still needs a real session. Same wall as blocker 1.

## The mobile artboard audit — coverage by screen code

Phase 10b claimed "every mobile screen is built to its artboard", and that was
true as written but misleading: it counted the app's **16 routes**, not the
design's **44 artboards**. A code-by-code audit of the mobile design file
(9 flows, 44 boards) found **21 built, 4 partial, 12 not built** across the 37
codes that describe app screens. Where a gap had a recorded reason it is cited
below; four had none at all.

**Stale as of the pass right after this one — read "Six more artboards
closed" further down before trusting any status below.** 7a, 7b, 1l, 7c and
7d moved from not-built/wrong-tree to built; 7h moved from partial to done
(minus fares, which stay out on purpose). 7f has since been built too (mobile
`/m/settings/key`). This table is kept for the codes that are STILL gaps: 6a,
3a–3d/1i, 5a/7i, and 7e.

**How to redo this audit.** The artboard index is one command — extract
`dv-opt` ids and their `dv-olabel` text from the design file, and group them
by the enclosing `dv-turn` flow. Do not eyeball it against the route list;
that is exactly the error Phase 10b made.

### Not built, with the reason

| Code | Screen | Why |
|---|---|---|
| 6a | Splash (animated) | Only a STATIC splash exists (`scripts/gen-resources.mjs` → `resources/splash*.png`). The animated one is a native-shell asset and `ios/`/`android/` do not exist — blocker 4. |
| 3a–3d, 1i | Restaurant menu → cart → details → tracking → checkout | **The design file itself rules these out.** The note trailing 3d says dine-in 7h is the shipped path and restaurant in-app ordering 3a–3d "stays a future concept; grocery buy is Flow 4." Also needs an orders table, and Swiggy MCP rejects our origin (Dead End 1). |
| 1l | Streak & mascot unlocks | Was blocked on the mascot-unlock gamification question. `loggingStreak` already existed, so this was a product decision, not a data problem. |
| 7d | Bottom-up notification prompt | Deferred. Consequence: combined with 2c also missing, NOTHING in the mobile tree ever asked for notification permission. |
| 7f | BYOK key screen | **DONE** — built as mobile `/m/settings/key`. Was web-only (`components/UpgradeDialog.tsx`); the mobile screen shares the `lib/byok` storage and is the target the paywall CTA and chat 429 now route to. |
| 5a, 7i | Dark-mode Home, dark dish detail | Deferred with the rest of dark mode, which still has never had a deliberate review. |

### Not built, and NO reason was ever recorded

**7a (Meet Bo intro), 7b (Bo works with your apps), 2c (streak &
notifications opt-in), 6b (account hand-off loader).** Four consecutive Flow 1
boards. The deferred list above named only "Meet Bo intro" and silently
dropped the other three. 2c and 6b are now built (see below).

### Built, but in the WRONG TREE

**7c (notifications) and 7e (link accounts / MCP).** Both HAD this problem —
they existed only as routes in the **web** group under
`app/(web)/(app)/settings/`. BOTH are now closed: 7c is `/m/settings/notifications`
and 7e is `/m/settings/connections`. `/m/profile`
pushed at `/settings/notifications`, which crosses root-layout groups: a full
document load into the web shell, sidebar and all. The mobile artboards for
these were never built.

### Partial

**7h (dine-in).** `/m/restaurants` "Go there" mode has Directions plus a
single Uber deeplink. The artboard also has Ola, a drive/walk ETA split, and
per-ride fare cards. Fares need a rides API we do not call. But
`buildOlaDeepLink` **already exists in `lib/deeplinks.ts` and only the WEB
`components/RestaurantView.tsx` consumes it** — the mobile screen simply never
got it.

### Two live bugs the audit surfaced — NOW FIXED

**Both closed** by building the mobile 7f screen (`app/(mobile)/m/settings/key`)
and wiring the two entry points at it, exactly as the plan below anticipated:
"point the paywall's BYOK CTA at it and open it from chat's 429." They were
index item B7.

- **`/m/paywall`'s BYOK CTA was a dead end.** With no purchasable offer the
  button reads "Use my own key" and `start()` pushed to `/m/profile`, which has
  no key field. It now pushes to `/m/settings/key`. (The CTA itself only renders
  on native, where `canPurchase` is false — on web/localhost the paid path shows
  instead, so this branch is not reproducible in the browser; the change is the
  one-line `router.push` target in `start()`.)
- **`/m/chat` had NO rate-limit handling at all.** `/api/chat` returns 429 with
  "Daily limit reached. Add your API key to continue."; mobile's `useChat` was
  configured without `onResponse`/`onError`, so a free user hitting the cap saw
  *nothing happen*. It now (a) reads the stored key from `lib/byok` at mount and
  passes `provider`/`apiKey` in the request body — so a key set on the new
  screen (or on web) actually lifts the cap — and (b) routes a 429 to
  `/m/settings/key?from=chat`, which shows the "hit today's free limit" copy and
  bounces back to `/m/chat` once a key is saved. A BYOK 400 (invalid key) is
  deliberately NOT routed there, to avoid looping the user to a screen where
  their bad key already sits.

**Shared cleanup done alongside:** the BYOK localStorage slots
(`crave_byok_provider` / `crave_byok_key`) were re-declared inline in three
places (web chat, web arena, hand-cleared in UserContext). They now live once in
`lib/byok.ts` (`getStoredBYOK` / `saveBYOK` / `clearBYOK`); all four call sites
import from it. `npx tsc --noEmit`, `next build`, and `npm run check:hex` are
clean; route count is now **73** (`/m/settings/key` added).

## Onboarding rebuilt — 2b, 2a, 2c, 2d, 6b (and what NOT to reverse)

The flow went from 5 steps to **10**: welcome → **Meet Bo (7a)** →
**works-with-apps (7b)** → location → diet → **tastes** → goals →
**calories** → **streak** → sign-in, plus a post-sign-in loader. (This
paragraph originally said "to 8" — that was before 7a/7b were added right
after welcome; see "Six more artboards closed" below for those two.) Only
location→sign-in carry the progress bar; welcome and the 7a/7b intro pair sit
outside it, which is the artboards' own structure — 7a draws no pager and 7b
draws its own two-segment one.

**2a/2b were labelled "superseded by 4c/4b" and were still worth building.**
The design file's own note calls 2a/2b/2d "greyed-history". That is right
about the LAYOUT and wrong about the CONTENT: 2b carries cuisine tastes and
hard-no allergies, which 4b (diet restrictions) never covered, and 2a carries
a calorie-target readout that 4c has no equivalent of. They were added as new
steps ALONGSIDE 4b/4c on an explicit user decision — **not** as replacements.
Do not "clean this up" by deleting 4b/4c; that loses Halal/Keto/Pescatarian
and breaks the goal→`WeightGoal` mapping, which only has three values.

**Decisions that will look like omissions later:**

- **2d's Apple and Facebook buttons are deliberately NOT built.**
  `OAuthProvider` is typed `"google" | "github"`, there is no Apple Services
  ID in Supabase, and Facebook was never wired anywhere. Both would be dead
  controls — the same class of defect as the Restore button that drew an App
  Store rejection. 2d's COPY ("Save your seat at the table") is used, because
  it describes what has by then actually been collected. **If Apple sign-in is
  ever wanted it is a dashboard + type change first, not a UI change** — and
  note that offering any third-party sign-in makes Sign in with Apple an App
  Store requirement, so this is a real pre-launch item, not cosmetic.
- **Hard-no allergies merge into `dietaryPreferences`** (as `avoid <x>` tags)
  rather than getting their own field. That array is already threaded into
  every AI path as a strict "must respect" list — chat, coach, ingredients,
  diet-chart. A new field would have needed all of them changed to be worth
  anything. **Tastes deliberately do NOT go there**: they are preferences, not
  restrictions, and putting "loves ramen" into a strict-filter array corrupts
  it. `favoriteCuisines` is captured, persisted **and now wired**, via
  `lib/taste-prompt.ts`, into chat (web/mobile/arena) and both coach prompts.
  It is a deliberately SOFT signal that stays OUT of `dietaryPreferences` for
  the reason above — most of the sentence it generates is spent telling the
  model not to treat it as a filter, because the failure mode is over-applying
  it, not ignoring it. It is deliberately NOT used by `/api/ingredients`, which
  expands an already-chosen dish: a cuisine preference must not put lemongrass
  in a rajma recipe.

## Six more artboards closed — 7a, 7b, 7h fix, 1l, 7c, 7d

Second pass over the audit's gap list. All six verified live in the browser,
not just built — see the per-item notes for what that verification covered.

- **7a (Meet Bo) + 7b (works with your apps)** land in onboarding right after
  welcome, as their OWN beat — 7a draws no pager and 7b draws its own
  two-segment one in the artboards, so they are outside `BAR_STEPS`, not
  folded into the 7-segment run. 7a's "Ask me anything" field is a static
  artboard prop; tapping it routes to the real `/m/chat` rather than opening a
  keyboard on a dead input. 7b's five partner tiles use hex-ok'd brand colours
  (same allowlisted pattern as `ConnectionsSection`) and its closing line says
  "Connect accounts anytime in Settings" deliberately, not "connect now" —
  only Swiggy has any linking path at all, and it's blocked upstream (Dead
  End 1).
- **7h's gap is closed on `/m/restaurants`**, not as a new route — 7h's
  header, rating and distance badge were already in that card, and a second
  screen would have duplicated the selection state. Two additions: an Ola
  button beside Uber (`buildOlaDeepLink` already existed in `lib/deeplinks.ts`
  and only the WEB `RestaurantView` called it — this was an omission, not a
  decision), and a real haversine-derived drive/walk ETA chip labelled
  "approx". **Deliberately NOT built: per-ride fares and pickup ETAs.** Those
  need a rides API this app doesn't call; inventing them on a screen a user
  is deciding from would repeat the exact fabricated-data mistake the recipe
  carrot rating and the 4f stepper were both held back over.
- **1l (streak & mascot unlocks) is a new route**, `/m/plan/streak`, reached
  from both flame chips (Home header, Plan tab). The unlock ladder lives in
  `lib/mascot-unlocks.ts` — 12 produce mascots (Bo excluded; he's the app's
  face from first launch, not something to unlock), thresholds 1/3/5/7/10 from
  the artboard extended to 14/21/30/45/60/90/120 on the same widening curve.
  This answers the `.mascot-locked` product question the original handoff
  parked, in the narrowest way that stays honest: everything derives from
  `loggingStreak` and real meal logs, nothing new is persisted, so clearing
  logs correctly re-locks the shelf and there's no unlock state to drift out
  of sync. Verified at streak 0 (all locked, "0 of 12", zero-width progress)
  and streak 4 (Carrot + Leek unlocked, "2 of 12", progress bar at the
  hand-computed 50% toward Beet).
- **7c (notifications) now has a MOBILE screen** —
  `/m/settings/notifications` — wired to the same `push-client` /
  `whatsapp-client` / `notifications-client` the web settings page uses, not
  a reimplementation. The web route is NOT deleted; it's still the desktop
  surface and still owns the Swiggy connection block, which has no mobile
  artboard. `/m/profile`'s two links now point here instead of cross-loading
  into the web shell; its Swiggy chip still goes to
  `/settings?tab=connections` on purpose, since account linking (7e) still has
  no mobile screen. Verified signed-out (toggles disabled, "sign in first"
  banner, static nudge preview) — the signed-in push/WhatsApp toggle paths
  need a real Supabase session to exercise, same gap as blocker 1.
- **7d (bottom-up notification prompt)** is
  `components/mobile/NotificationPrompt.tsx`, mounted on Home. Deliberately
  narrower than "show it sometime": gated on signed-in AND push supported AND
  permission still `"default"` (re-prompting after a denial is impossible
  anyway) AND an actual streak (day 1 has nothing to protect — the artboard's
  own hook is "keep your streak alive") AND not already asked. It shares a
  seen-flag with onboarding's 2c step, which was fixed in the same pass: 2c's
  "Skip" and "Maybe later" previously called the SAME handler as the primary
  "Light the flame" button, so skipping still silently fired a real
  `enableWebPush()` because the toggle defaults on — a real bug, not
  something 7d introduced, caught while wiring the shared flag. Skip/maybe
  now take a separate path that persists nothing about push. Uses
  `.sheet-scrim`, which `mobile.css` already defined for exactly this
  (bottom sheet over a dimmed backdrop) but had zero consumers until now.
  Verified rendered (temporarily forced `show` to `true`, screenshotted,
  reverted — the real gate needs a signed-in session to reach naturally).

**New shared pieces from this pass:** `components/mobile/Switch.tsx` (the
token-only toggle onboarding's 2c introduced, now shared with 7c rather than
duplicated) and `lib/mascot-unlocks.ts` (the unlock ladder, so the shelf and
any future consumer of it cannot drift apart the way `mm-dot` once did).

**Not touched, and worth naming so it isn't assumed done:** 7e (link
accounts) still has no mobile screen — it's the other half of what `/m/profile`'s
Swiggy chip now points at on web. (7f BYOK key entry has since been built as
mobile `/m/settings/key` — see "Two live bugs the audit surfaced".) 3a–3d
restaurant ordering is still explicitly out of scope per the design file's own
note. Dark mode still has no deliberate review.

## Dark-mode mobile: measured findings

The "dark mode never reviewed" item was turned into DATA. `crave_theme=dark`,
mobile viewport, contrast measured on home / recipe / plan / paywall /
connections. `/m/settings/connections` (7e) is CLEAN in both themes (all ≥ AA)
because it was built token-only. The older screens are not. Three buckets:

**A. App-level failures — fixable without touching vendored files:**
- The `color: var(--m-forest)` inline on `.t-cap` LINKS fails on the dark
  ground: `--m-forest` is `#2E7A48` in dark, ~3.2–3.99:1 on the card/body.
  ~7 sites: `app/(mobile)/m/(tabs)/page.tsx` ("See all" ×2),
  `.../plan/page.tsx`, `.../chat/page.tsx`, `m/recipe/page.tsx` (prices, "+N
  more steps"), `m/log/page.tsx`, `m/settings/key/page.tsx`, `m/onboarding`.
  This is the `--figure-accent` situation from web, but the mobile tree does
  NOT import globals.css — it needs its own per-theme accent token in
  `m/mobile.css` (forest on light, a lighter green on dark), then swap the
  inline colours to it.
- **`m/recipe/page.tsx:229` dietary-tag chips are the WORST at 1.35:1** —
  nearly invisible. `{ background: var(--m-tint-lav), color: var(--m-plum) }`:
  in dark, tint-lav is `#342639` and plum stays `#5C2B67`, so it is dark-on-
  dark. The `--m-tint-peach` / `--m-burnt` sibling tag is 4.37. Fix per the
  status-pill pattern the handoff already documents (hue text that tracks the
  theme on a tint of the same hue), NOT bare hue-on-tint.

**B. Vendored meshi-b — a DESIGN-SYSTEM decision, do not silently touch:**
- `.badge-burnt` renders white on `--m-burnt` at **2.87:1**, and `.pill-lime`'s
  `--m-forest-2`-on-`--m-lime` is **4.43:1** (a hair under AA for its 14px/700
  label). Both are defined in `design/meshi-b.css`, which is the vendored
  design-system file BOTH trees share and which DESIGN.md requires to stay a
  faithful copy. Changing them is a call about the design system itself, not a
  mobile screen fix — and it would also move the web tree. Flag to the user;
  do not edit meshi-b to chase a mobile contrast number without that decision.

**C. Scanner false-positives — NOT failures:**
- `.on-plum` / `.on-plum-faint` reported ~1:1. That is a MEASUREMENT artifact:
  they are cream text designed for a plum ground, and a naive
  walk-up-for-background misses the plum panel, resolving cream-on-cream. Same
  correct-by-design pattern the web paywall uses. Verify any `.on-*` hit by eye
  before "fixing" it.

## What's actually next

**Phase 10 is complete, and the hex debt baseline is at ZERO.** The screens
that had no web artboard — admin console, `/favorites`, `/arena`, `/settings`
+ its three sections, and `FavoriteButton` / `SwiggyExpiryBanner` /
`UsageBadge` — were converted by extending the system rather than copying a
design, using one consistent semantic mapping (forest = active, burnt = warn,
red = error, plum = info; see DESIGN.md). `scripts/hex-baseline.json` is now
an empty ratchet: a non-empty one is a regression.

**Two real bugs surfaced during that conversion, both invisible until the
tokens forced the question:**

- **The landing's entire FAQ was pinned to a literal Midnight Kitchen ink
  (`#1c1917`) in BOTH themes.** In dark mode that measured **1.04:1** against
  the dark background — the whole section was effectively invisible, and had
  been since the light-first flip. Now 11.42:1 light / 13.85:1 dark.
- **The admin dashboard's KPI tiles built their tint by string-appending a hex
  alpha pair** (`` `${iconColor}18` ``). That only parses when the value is a
  literal hex — the DAU card already passed `var(--m-forest)`, producing
  invalid CSS, so that tile rendered with no background at all. Switched to
  `color-mix`, which works for both.

**A later pass fixed three wLa mismatches that had survived all of 10c** —
display weights at 600/500 instead of 800, the legacy `.btn-pill-*` instead of
meshi's pills, and a 48px nav where wLa is 76px. **These were caught by eye,
not by the verification process**, which had only ever checked that tokens
resolved and contrast passed. Trap 10 explains what to diff instead. If you
convert another screen, compare the artboard's literal `font:` declarations
and button classes, not just its colours.

The real blocker remains **Phase 5 — production cutover**, which needs the env
vars listed at the top of this file. Nothing in Phase 10 unblocks it.

**Still-unverified marketing copy on the landing.** The testimonials are gone,
but the forest STATS band's remaining values — "50+ cuisines Bo speaks" and
"<10s to a full recipe" — were never checked against anything. ("4 AI models …
& Grok" WAS checked, and was false; it is 3 and there is no Grok.) Verify or
cut them before the landing is public.

Three things worth doing before more UI:

- **A real-device pass on `/m/log`** — still outstanding, but much smaller than
  it was. The viewfinder's logic is now exercised and a fatal bug in it is
  fixed (see the `/m/log` section above); what hardware still has to settle is
  the real permission prompt, whether `facingMode: "environment"` actually
  picks the rear camera, photo orientation/EXIF on a portrait shot, and iOS
  Safari's real autoplay behaviour.

  **It cannot be done from this repo alone, and the reason is worth knowing:**
  `getUserMedia` requires a secure context, so a phone pointed at this Mac's
  LAN address over plain http will refuse regardless of permissions. `ios/` and
  `android/` do not exist either (blocker 4), so there is no native shell to
  test in. The two workable routes:

  ```bash
  # A. HTTPS dev server — phone on the same Wi-Fi, no tunnel, no account
  npx next dev --experimental-https
  # then browse https://<this-mac-LAN-IP>:3000/m/log and accept the warning
  ```

  Or **B**, an HTTPS tunnel (ngrok et al.) — note that exposes the dev server
  publicly, so prefer A on a trusted network.
- **A deliberate dark-mode review.** The dark token pass renders (set
  `crave_theme=dark`), but no screen has been designed or checked against it.
  Note this is now BIGGER than it was: the nine new screens were all built
  and verified in light only.
- **Exercise the new screens with a real session.** `/m/settings/notifications`
  (7c) was verified signed-OUT only — the push toggle, the WhatsApp enrol +
  JOIN + poll loop, and the test-send buttons all need a real Supabase
  session, which is the same wall as blocker 1. 7d's prompt likewise only
  ever rendered via a forced flag, never through its real gate.

Method reminder: extract the flow's artboards from the mockup and build from
the markup. The Flow 3 rebuild used
`sed -n '<start>,<end>p' meshi-mobile.html` to cut a flow out, then split it on
`<div class="dv-opt" id=` to get one file per artboard — cheap, and it keeps
the 190KB file out of context. Flow line offsets are found with
`grep -n 'dv-tname' meshi-mobile.html`.

Two things that can happen in parallel and unblock more than they cost:

- **Set `ADMIN_EMAIL`** (Vercel + `.env.local`, which still holds the
  `your-email@gmail.com` placeholder). Until then the entire admin console
  built in Phases 7–8 has never been seen rendered — it has only been verified
  through API responses and the redirect. That is the largest untested surface
  in this branch.
- **Add `com.cravecreate.app://auth/callback`** to Supabase redirect URLs. It
  costs a minute and de-risks the single highest-risk unverified path in the
  whole project (native sign-in), which otherwise surfaces at TestFlight after
  the IAP work.

The branch is pushed, so review can start whenever you want — it touches auth,
payments, the database and the entire mobile UI, and is worth a read before it
merges.
