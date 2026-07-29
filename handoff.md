# Handoff — Crave & Create

Last updated: 2026-07-12. Written for a session with zero prior context.

## Goal

Bring the app's UI to consumer-app quality (Airbnb/Instacart/Runway bar) on a documented design system, and ship a settings + admin feature-flag foundation so future integrations toggle on at runtime instead of requiring rewrites.

**Done looks like:** every surface reads from `--cc-*` tokens and `components/cc/` primitives per `DESIGN.md`; no duplicate settings surfaces; MCP connector cards flip from "Coming soon" to functional when their flag is enabled.

The design-system and settings work is **merged and live on `main`**. What remains is cleanup (below), not a rewrite.

## Current State

**Known-good, merged to `main` (`a927878`), Vercel green:**
- Design system: warm "Midnight Kitchen" palette, self-hosted General Sans + Geist, `components/cc/` primitives, `DESIGN.md` + `CLAUDE.md`.
- Landing page (`app/page.tsx`) — fully rebuilt, verified in browser (dark, light, mobile).
- Consolidated settings (`app/settings/page.tsx`) — Notifications / Connections / Account tabs.
- Feature flags — table + API + client hook, migration **already applied to production Supabase**.
- Chat UI redesign (`app/chat/page.tsx`) — reading column, slim header, click-to-open avatar menu, unbubbled AI text, scroll-to-bottom, regenerate.

**In progress:**
- **PR #29 is open, mergeable, checks green, not merged.** Converts 15 JS hover handlers → CSS classes across 10 files. Branch `claude/awesome-nightingale-f467b4`, commit `ace6168`, lives in a separate worktree (see Environmental Notes). This is the immediate next action.

**Known-imperfect (not broken, but unresolved):**
- **Two live settings surfaces.** `app/settings/page.tsx` (new) and `app/settings/notifications/page.tsx` (old, ~900 lines) both exist and both work. The old one is *not* orphaned — it is the Swiggy OAuth callback target and has 6+ inbound references. See Open Questions.
- `#0a84ff` (info blue) appears 8× and is **not** documented in `DESIGN.md`. Undocumented drift, not a visual bug.

**Never verified:** the signed-in chat surface. `/chat` is Google-auth-gated and could not be reached headlessly. Every chat claim is compile/build-verified only, **not** visually confirmed. Treat the chat redesign as unproven in the browser.

## Files in Play

Merged and stable (modify freely, they are the reference implementation):
| Path | Status |
|---|---|
| `app/globals.css` | modified, working — token source of truth |
| `app/layout.tsx` | modified, working — font wiring |
| `app/page.tsx` | rewritten, working, visually verified |
| `app/chat/page.tsx` | rewritten, builds clean, **not visually verified** |
| `components/cc/{button,chip,card,section,status-pill,icon-badge}.tsx` | new, working |
| `components/BottomNav.tsx` | modified, working |
| `app/settings/page.tsx` + `app/settings/sections/*.tsx` | new, working |
| `app/api/admin/flags/route.ts`, `lib/feature-flags.ts` | new, working |
| `app/admin/page.tsx` | modified, working — flags panel added |
| `DESIGN.md`, `CLAUDE.md` | new — read before any UI change |
| `scripts/sql/feature-flags.sql` | new — **already applied**, do not re-run blindly |

Uncommitted / pending:
| Path | Status |
|---|---|
| PR #29's 10 files (`app/{admin,arena,favorites,planner}/page.tsx`, `components/{AuthButton,FavoriteButton,RecipeView,ShareButton,ThemeToggle,UpgradeDialog}.tsx`) | committed on `claude/awesome-nightingale-f467b4`, awaiting merge |
| `app/settings/notifications/page.tsx` | untouched legacy — superseded in intent, still load-bearing |
| `.claude/` | untracked in repo root; contains `launch.json`. Intentionally uncommitted |

## Changes Made

- **Fonts:** added `app/fonts/GeneralSans-Variable.woff2` (+ license), wired via `next/font/local` as `--font-display`. **Deleted an inline `style={{fontFamily: "SF Pro Display"...}}` on `<body>`** in `app/layout.tsx` that was overriding Geist — SF Pro doesn't exist off-Apple, so Android/Windows users were seeing Arial while Geist shipped unused.
- **Palette:** replaced pure-black/Apple-gray surfaces with warm charcoal (`#0c0a09`→`#34302c`), warm off-white light theme, orange link/focus (`#ffa06b`/`#ff8a4d`) replacing Apple Blue (`#2997ff`/`#0071e3`, both now fully gone). Token *names* unchanged, so ~663 existing `var(--cc-*)` call sites inherited it free.
- **Radius scale** changed: 5/8/12 → 6/10/14px.
- **New:** `components/cc/` (6 primitives), `lib/feature-flags.ts` (`useFeatureFlags`, `useFlag`, `invalidateFlagCache`), `app/api/admin/flags/route.ts` (GET public; PATCH/POST admin-gated by `ADMIN_EMAIL`).
- **DB:** created `public.feature_flags` (RLS: public read, service-role write) seeded with 6 flags — `mcp_swiggy`/`mcp_instacart`/`mcp_zomato` = **false**, `agent_mode`/`meal_planner`/`pro_upgrade` = **true**. Applied to Supabase project `lxaaclelfhjmqrhdqzxp`.
- **Assets self-hosted:** 3 Lotties moved from `lottie.host` → `public/lottie/`; 3 WebP food images → `public/images/`. No runtime third-party asset deps remain.
- **Hex sweep:** ~99 hardcoded colors → tokens. Survivors are deliberate: partner brands (`#fc8019`, `#f8d800`, `#43b02a`), semantic status (`#ff453a`, `#ff9f0a`, `#34c759`), Razorpay theme, Google Maps style JSON, marker SVG data-URIs.
- **No dependencies added or removed.** `package.json` untouched throughout.

## Dead Ends — Do Not Retry

**1. Swiggy MCP OAuth from this web app. Abandoned — architecturally blocked.**
Attempted dynamic client registration against Swiggy's MCP OAuth so users could connect Swiggy accounts in-app. Reasonable because Swiggy publishes an MCP server and DCR is in the spec. Failed at the authorize screen: **"Oops, Vercel isn't whitelisted yet."** Root cause: Swiggy gates OAuth to a hardcoded allowlist of AI clients (Claude, VS Code, Cursor); a custom web origin can never complete the flow regardless of correct DCR/PKCE. No amount of client-side work fixes this. The exploratory branch was deleted, **but its migration was already applied** — `swiggy_tokens` in production still carries now-unused `refresh_token` and `client_id` columns. The Connections tab exists precisely as the flag-gated placeholder for when/if access is granted. Do not re-attempt without confirmed whitelist access from Swiggy.

**2. `whileInView` with `initial={{ opacity: 0 }}` for section reveals. Do not reintroduce.**
The landing "See it in action" section rendered as a pure black void — content existed in the DOM but stayed at opacity 0 because the viewport trigger never fired in headless/full-page capture. Root cause: gating *visibility* on a scroll event makes content conditional on JS + scroll behavior. Fix applied: animate transform only (`initial={{ y: 16 }}`), never opacity-from-zero. Same rule now in `DESIGN.md` under Motion.

**3. `Claude_Preview.preview_screenshot` for below-the-fold verification. Unreliable here.**
After `preview_eval` scrolling, it repeatedly returned stale all-black frames while `elementsFromPoint` and computed styles proved the content was visible and opacity 1. Wasted several cycles chasing a phantom rendering bug. Root cause not fully determined (suspect capture timing vs. scroll compositing). Workaround that *does* work: the gstack browse binary at `~/.claude/skills/gstack/browse/dist/browse` — `$B goto <url>` then `$B screenshot <path>` gives correct full-page captures.

**4. Blanket `sed` of `#ff6b35` → `var(--cc-accent)`.**
Fast and mostly right, but it corrupted `components/UpgradeDialog.tsx:55` — the Razorpay SDK `theme.color` runs inside a third-party iframe where CSS custom properties do not resolve, silently breaking checkout theming. Had to restore the literal. Rule: before any bulk color replacement, exclude third-party SDK config objects, Google Maps style JSON, and SVG data-URI strings.

**5. `preview_start` on port 3000 while a second Claude session is running.**
Fails hard: `Port 3000 is in use by another chat's dev server`. `preview_stop` cannot kill another session's server. Fixed by adding `"autoPort": true` to `.claude/launch.json`; the preview now takes a random high port.

## Key Decisions & Assumptions

- **Kept `#ff6b35` orange.** Brand equity; the redesign changed everything around it, not the accent itself.
- **General Sans (Fontshare, free license) over Fraunces.** Confident grotesk, low taste risk. Variable font = one 38KB file for all weights.
- **Two component directories, deliberately:** `components/ui/` = stock shadcn (Tailwind-theme tokens), `components/cc/` = brand primitives (`--cc-*` tokens). Do not merge them. Reach for `cc/` first for anything user-facing.
- **`.section-dark` / `.section-light` are fixed bands, not theme-following.** They intentionally keep their color in both themes. Headlines inside them use `color: inherit` via an explicit override in `globals.css` — without it the landing hero went invisible in light mode. If you add a headline to a fixed band, verify it in *both* themes.
- **Admin is email-based** (`ADMIN_EMAIL` server-side, `NEXT_PUBLIC_ADMIN_EMAIL` client-side), not a DB role column. Simple, but single-admin only — revisit if a second admin is ever needed.
- **Feature flags are public-readable** by design (app-wide config, not secrets). Client caches them in-memory; admin toggles call `invalidateFlagCache()`. **Unverified assumption:** other tabs/sessions won't see a flag change until reload. Confirm before relying on flags for anything time-sensitive.
- **`components/RestaurantView.tsx:185` `onMouseEnter` is behavioral, not stylistic** — it drives card→map-pin sync. PR #29 correctly leaves it alone. Do not "clean it up."

## Next Steps

1. **Merge PR #29** (immediately runnable, checks already green):
   ```bash
   gh pr merge 29 --merge --delete-branch=false && git checkout main && git pull origin main
   ```
2. **Visually QA the signed-in chat surface** — the only untested work. Start the dev server via `preview_start` (name: `dev`), sign in with Google, then confirm on `/chat`: time-aware greeting shows your first name; avatar menu opens on click *and* on touch and closes on Escape/outside-click; AI replies render unbubbled in the centered column; recipe/restaurant cards use the wider lane; scroll-to-bottom pill appears after scrolling up; Regenerate refires the last prompt. Also check mobile width — the composer must sit above `BottomNav`.
3. **Resolve the duplicate settings surface.** Decide per Open Questions, then either redirect or migrate. Minimum viable fix if consolidating: point `app/api/swiggy/auth/callback/route.ts:78` and the 3 `<Link>`s in `components/SwiggyExpiryBanner.tsx` at `/settings?tab=notifications`, update `app/planner/page.tsx:78` and `app/api/notifications/push/test/route.ts:36`, fix the error string in `app/chat/page.tsx` that reads "Reconnect in Settings → Notifications", then delete `app/settings/notifications/page.tsx`.
4. **Decide on `#0a84ff`** — either add it to `DESIGN.md` as the sanctioned info/data color and promote it to a `--cc-info` token, or replace it. It is currently used in `app/admin/page.tsx`, `app/arena/page.tsx`, `components/RecipeView.tsx`, `components/SwiggyExpiryBanner.tsx`, `components/planner/{CoachPanel,MacroBars}.tsx`.
5. Optional cleanup: drop the unused `refresh_token` / `client_id` columns from `swiggy_tokens`, and delete the empty `design-md/` directory (contains only `.DS_Store`).

## Open Questions

- **Should `/settings/notifications` be deleted or kept as a deep-link target?** It is genuinely load-bearing today (OAuth callback lands there). Consolidating requires touching the callback route — needs a decision before anyone deletes it.
- **What triggers enabling `mcp_instacart` / `mcp_zomato`?** The cards are placeholders; no integration exists behind them. Unknown whether either provider offers a usable MCP endpoint. `mcp_swiggy` is blocked per Dead End #1.
- **Is `#0a84ff` an intentional info color or leftover drift?** Predates this work; user has not weighed in.
- **Is single-admin-by-email sufficient long term?**
- Vercel CLI is outdated locally (`56.2.1` → `58.1.0`). Unclear whether anything depends on it; deploys go through GitHub integration, so likely harmless.

## Environmental Notes

- **Branch: `main`, at `a927878`, synced with `origin/main`. Working tree clean** apart from untracked `.claude/`.
- **Multiple git worktrees exist — this is the biggest footgun here.** `git worktree list`:
  - `/Users/vijaypanwar/Projects/create-shop-crave-main` → `main` (the real repo root; work here)
  - `.../.claude/worktrees/interesting-bardeen-1fe2f0` → `claude/awesome-nightingale-f467b4` (PR #29)
  - `.../.claude/worktrees/stupefied-meitner-4cc851` → `feat/swiggy-polish` (stale, already merged as #25)

  A `cd` into a worktree **persists across Bash calls**. During this session a `git checkout`/`git pull` unintentionally ran inside the PR #29 worktree because of exactly this. It was a harmless fast-forward and nothing was lost, but **run `pwd` before any git state-changing command.**
- **Port 3000 is occupied** by a leftover `node` dev server (PID `13969` at time of writing). `.claude/launch.json` has `"autoPort": true`, so `preview_start` will pick a free high port automatically — use the port it reports, not 3000.
- **Env vars required** (present in `.env.local`, absent from the repo): `ADMIN_EMAIL`, `NEXT_PUBLIC_ADMIN_EMAIL`, plus Supabase / Gemini / Maps / Razorpay / Twilio keys. See `.env.example`.
- **Supabase project:** `lxaaclelfhjmqrhdqzxp` (`crave-and-create`, ap-south-1). Reachable via the Supabase MCP tools. The `feature_flags` migration is **already applied** — verify with a `select` before running any migration file.
- **Verification commands:** `npx tsc --noEmit` and `npm run build` both pass on `main` as of this writing. There is no test suite — `npm run lint` and the build are the only automated gates.
- Merged this cycle: PRs #26, #28, #27 (in that order). #29 outstanding.
