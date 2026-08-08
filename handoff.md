# Handoff — Crave & Create (web + mobile, unified)

Last updated: 2026-08-08. Written for a session with zero prior context.
Supersedes the two separate handoffs that lived in the web and mobile repos.

## Goal

One codebase, one backend, one design system serving a web app and a
Capacitor-wrapped iOS/Android app; plus an admin console that configures plans,
limits, and MCP providers at runtime instead of in code.

Full roadmap: `~/.claude/plans/let-s-revisit-so-far-proud-marshmallow.md`.
That file owns sequencing. This file records state.

## Where the work lives

All of it is on **`merge/mobile-into-web`**, which is **fully pushed** —
local `HEAD` and `origin/merge/mobile-into-web` are both at `038c555`, 0 ahead
/ 0 behind, working tree clean. `main` is untouched at `ac8a8cc` (local and
origin), and both deployments still serve the old code.

**"Pushed" is not "shipped."** Nothing here reaches a user until Phase 5
merges to `main`. The branch existing on the remote only means it is backed up
and reviewable. An earlier version of this section said "unpushed" and caused
exactly this confusion — if you are wondering whether the work is safe, run
`git status` rather than trusting this paragraph.

**There is deliberately NO open PR.** Opening one implies the branch is ready to
merge, and Phase 5 cutover is blocked on env vars (below). Open it when those
are set:

```bash
gh pr create --base main --head merge/mobile-into-web --web
```

**Commit counts — do not be surprised.** `git log main..HEAD` now returns
**62** commits. The itemized 14 below cover only through the merge
consolidation (`3910bc1`); everything after that is Phase 10c screen-by-screen
design work (landing, sign-in, chat — see the Phase 10c section further down
for that history in detail, or `git log 3910bc1..HEAD --oneline` for the raw
list). Of the original 35, only 14 were this work — the other ~21 were the
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

`npx tsc --noEmit` and `next build` are clean (69 routes).

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
| 9 native iOS/Android + IAP | code-level done; **binaries blocked on toolchain** |
| 10 meshi re-skin | **10b mobile DONE**; **10c web IN PROGRESS** (foundation + sidebar + landing + sign-in + chat landed; recipe view, cart, tracker/planner, paywall, `components/cc/*` still pending); 10d/10e pending |

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

### Screens rebuilt to artboards (16 of 16, plus one new route)

| Flow | Screens |
|---|---|
| 1 Onboarding | welcome, location, diet, goal |
| 2 Home & discovery | Home, Discover (`/m/search`), Restaurants |
| 3 Chat & recipes | chat, recipe |
| 4 Buy journey | buy, buy/platform, buy/confirmed |
| 6 Tracking | plan, plan/week, plan/diet-chart, **`/m/log` (new)** |
| 7 Saved & account | saved, profile, inbox, paywall |

### Phase 10b (mobile) is COMPLETE

Every mobile screen is built to its artboard. The exit check:

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
  fall back to a file picker. **The getUserMedia path has never been exercised**
  — camera access is blocked in the preview browser — so it needs a real-device
  check.
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
     perfectly good `text-[var(--cc-text-secondary)]` that never applied.
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
   values** (`text-[rgba(250,249,247,0.68)]`). The light-first flip made them
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

**Fabricated marketing content on the landing — decide before launch.** The
three testimonials (`TESTIMONIALS` in `app/(web)/page.tsx`) are invented
placeholder quotes with invented names, and they pre-date this work. The wLa
conversion added carrot ratings and avatar discs, which makes them look more
credible than they are. Replace with real quotes or delete the section before
the landing is public. The STATS figures are marketing claims too and were not
verified against anything.

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

Two entries left this list and the text above did not follow them, which is
worth stating so they are not "re-deferred" by a future reader:

- **camera capture and Bo's verdict (3e + 3f) ARE built** — `app/(mobile)/m/log`
  is one route with `phase: "capture" | "verdict"`. See the `/m/log` section
  above, including the `getUserMedia` path that still needs a real-device pass.
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
- `app/(mobile)/m/mobile.css` — mobile-only utilities meshi-b lacks
- `components/mascots/*` — 13 mascots + lookup map
- **Mobile tree is fully off `--cc-*`** — the only hit is a comment in
  `app/(mobile)/layout.tsx` explaining the split, not a token reference.
- **`--cc-*` is still named in 52 files** — 22 under `app/(web)`, 27 under
  `components/`, plus `app/globals.css` (78 definitions),
  `app/global-not-found.tsx`, and the mobile comment above. That count is NOT a
  progress bar for 10c: since `--cc-*` became an alias layer over `--m-*`, a
  screen can be fully rebuilt to its artboard and still name alias tokens.
  Chat, for instance, is converted and greps zero; the landing is converted and
  still names 25. The count only goes to zero in **10e**, which deletes the
  aliases. Judge 10c screen-by-screen against the artboard list above, not by
  this number.

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

**Phase 10b (mobile) is done. Phase 10c (web) is started, not finished.**
Next, in order:

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
   - ~~sign-in~~ — **DONE.** `components/AuthButton.tsx` + the landing's auth
     modal now match w1b's CARD (Bo circle, "Welcome back", provider stack).
     Stayed a modal, not a new route — see the 10c decisions below for why,
     and for what the artboard shows that was deliberately not built.
   - ~~chat~~ (`w3a`) — **DONE.** `app/(web)/(app)/chat/page.tsx`'s old sticky
     header (brand mark, avatar dropdown with Saved/Planner/Arena/Settings/
     theme/sign-out, usage badge) is replaced by w3a's topbar — this was the
     page the topbar work was held back for, since the sidebar (AppShell)
     already covers that nav. **Not fully redundant — a real gap, not fixed
     here.** Sign-out still works, one click further (Settings nav item →
     `/settings`'s `AccountSection`, which has the real `signOut()`), but
     theme toggle has no home anywhere in the logged-in app: `components/
     ThemeToggle.tsx` only appears on the pre-auth landing nav, and AppShell's
     `.side-acct` is a static display, not a clickable menu. Giving it one is
     future work, not silently claimed as done — see chat/page.tsx's top
     comment for the same note in situ. Message bubbles, the typing
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
   - **paywall/UpgradeDialog** (`w5a`) — not started.
   - **`components/cc/*`**, still Midnight Kitchen primitives.
   Every web page is currently phone-width inside a 1280px shell — the pages
   have no desktop layout yet. That is the single most visible gap.
2. **Phase 10d** — mascot motion (`Meshi Mascot Animations.dc.html`), plus the
   `#ff6b35` cleanup that still lives in `components/UpgradeDialog.tsx`'s
   Razorpay `theme.color` and `scripts/gen-resources.mjs`, and regenerating
   `resources/*.png`.
3. **Phase 10e** — the CI hex check and deleting `--cc-*`.

Two things worth doing before more UI:

- **A real-device pass on `/m/log`.** The `getUserMedia` viewfinder has never
  run — camera access is blocked in the preview browser, so only the file
  fallback has been exercised.
- **A deliberate dark-mode review.** The dark token pass renders (set
  `crave_theme=dark`), but no screen has been designed or checked against it.

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
