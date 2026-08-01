# Handoff — Crave & Create

Last updated: 2026-07-29. Written for a session with zero prior context.

## Goal

Bring the app's UI to consumer-app quality (Airbnb/Instacart/Runway bar) on a documented design system, and ship a settings + admin feature-flag foundation so future integrations toggle on at runtime instead of requiring rewrites.

**Done looks like:** every surface reads from `--cc-*` tokens and `components/cc/` primitives per `DESIGN.md`; no duplicate settings surfaces; MCP connector cards flip from "Coming soon" to functional when their flag is enabled.

**All planned design-system, settings, and cleanup work described in the previous version of this file is now merged to `main`.** There is no open PR and no pending branch work. What remains is the handful of items in Next Steps / Open Questions below — decisions, not half-finished code.

## Current State

`main` is at `76c432e`, synced with `origin/main`, working tree fully clean (`.claude/` is now gitignored, not just untracked). `npx tsc --noEmit` passes. No open PRs.

**Merged and working:**
- Design system: warm "Midnight Kitchen" palette, self-hosted General Sans + Geist, `components/cc/` primitives, `DESIGN.md` + `CLAUDE.md`.
- Landing page (`app/page.tsx`) — visually verified (dark, light, mobile).
- Consolidated settings (`app/settings/page.tsx`) — Notifications / Connections / Account tabs.
- Feature flags — table + API + client hook, migration applied to production Supabase.
- Chat UI redesign (`app/chat/page.tsx`) — reading column, slim header, click-to-open avatar menu, unbubbled AI text, scroll-to-bottom, regenerate. **Still never visually verified signed-in** (see below).
- JS hover-handler → CSS conversion across 10 files (PR #29), including one token-drift fix caught in review (`#ff5520` → `var(--cc-accent-hover)` in `components/UpgradeDialog.tsx`).
- `.claude/` added to `.gitignore` (PR #31).

**Known-imperfect, unchanged from before, still unresolved:**
- **Two live settings surfaces still exist.** `app/settings/page.tsx` (new) and `app/settings/notifications/page.tsx` (old, ~900 lines) both work. The old one is still not orphaned — confirmed again this session: 6 inbound references remain (`app/planner/page.tsx:78`, `app/api/swiggy/auth/callback/route.ts:78`, `app/api/notifications/push/test/route.ts:36`, `components/SwiggyExpiryBanner.tsx` ×3). It is the Swiggy OAuth callback target. Nobody has decided whether to consolidate.
- **`#0a84ff`** (info blue, 8 uses across `app/admin/page.tsx`, `app/arena/page.tsx`, `components/RecipeView.tsx`, `components/SwiggyExpiryBanner.tsx`, `components/planner/{CoachPanel,MacroBars}.tsx`) is still not in `DESIGN.md`. Confirmed still absent this session.

**Never verified:** the signed-in chat surface. `/chat` is Google-auth-gated and still hasn't been reached in a browser session. Every chat-redesign claim remains compile/build-verified only.

**Intentionally untouched (explicit user instruction — do not clean up without asking again):**
- 27 other local branches / 6 other remote branches beyond `main`, all already merged into `main` under different SHAs (squash/merge via PR). Deleting them is safe by content, but the user twice declined ("dont do anything and dont delete the stale branches"). Do not delete branches unless the user asks again in this session.
- `local-backup` branch — an **orphan root commit** (`38e2b45`, no parent, disconnected from `main`'s history), a full codebase snapshot from 2026-03-31. Not reachable from anywhere else. If ever deleted without tagging first, the snapshot becomes unreachable and will eventually be garbage-collected. User was offered "tag then delete" and explicitly declined any action. Leave it alone.

## Files in Play

Nothing is mid-edit. Everything below is committed and merged; listed for orientation, not because it needs further work:

| Path | Status |
|---|---|
| `app/globals.css` | merged, working — token source of truth |
| `app/layout.tsx` | merged, working — font wiring |
| `app/page.tsx` | merged, working, visually verified |
| `app/chat/page.tsx` | merged, builds clean, **not visually verified** |
| `components/cc/{button,chip,card,section,status-pill,icon-badge}.tsx` | merged, working |
| `components/BottomNav.tsx` | merged, working |
| `app/settings/page.tsx` + `app/settings/sections/*.tsx` | merged, working |
| `app/settings/notifications/page.tsx` | merged, legacy, still load-bearing (see Open Questions) |
| `app/api/admin/flags/route.ts`, `lib/feature-flags.ts` | merged, working |
| `app/admin/page.tsx` | merged, working — flags panel added |
| `DESIGN.md`, `CLAUDE.md` | merged — read before any UI change |
| `scripts/sql/feature-flags.sql` | merged — **already applied**, do not re-run blindly |
| `handoff.md` | this file |
| `.gitignore` | merged — now includes `.claude/` |
| 10 files touched by the hover-handler conversion (`app/{admin,arena,favorites,planner}/page.tsx`, `components/{AuthButton,FavoriteButton,RecipeView,ShareButton,ThemeToggle,UpgradeDialog}.tsx`) | merged, working |

## Changes Made

Since the previous handoff, three PRs merged in this order:

1. **PR #29** — JS hover handlers (`onMouseEnter`/`onMouseLeave` inline style mutation) replaced with Tailwind `hover:` classes across 10 files. One file, `components/RestaurantView.tsx:185`, deliberately still uses `onMouseEnter` — it drives card-to-map-pin sync (behavioral, not stylistic), correctly left alone. Reviewed before merge: a fresh `#ff5520` literal in `UpgradeDialog.tsx` was replaced with the existing `--cc-accent-hover` token before merging (commit `13014bc`), since a new hardcoded hex would have violated the "no hardcoded hex" rule this whole effort exists to enforce.
2. **PR #30** — added the original `handoff.md`.
3. **PR #31** — one-line `.gitignore` addition (`.claude/`). The directory was never tracked, so no `git rm --cached` was needed; this only stops it appearing as untracked noise.

No dependencies added or removed. No schema changes. No new environment variables.

One process note worth recording: three PRs existed in a stacked/parallel state (`#26 → #28 → #27`, plus an untracked `#29` from a background session) and needed sequencing — base branches were retargeted to `main` one at a time as each dependency landed, not merged all at once. That work is done; mentioned here only because the pattern may recur if more design-system follow-ups get stacked.

## Dead Ends — Do Not Retry

**1. Swiggy MCP OAuth from this web app. Abandoned — architecturally blocked.**
Swiggy's MCP OAuth gates to a hardcoded allowlist of AI clients (Claude, VS Code, Cursor, etc). A custom web origin gets **"Oops, Vercel isn't whitelisted yet"** at the authorize screen, regardless of correct DCR/PKCE implementation. No client-side fix exists. The abandoned migration left unused `refresh_token`/`client_id` columns in production's `swiggy_tokens` table. The Connections tab in Settings is the flag-gated placeholder for if/when access is granted. Do not re-attempt without confirmed whitelist access from Swiggy.

**2. `whileInView` with `initial={{ opacity: 0 }}` for section reveals. Do not reintroduce.**
Gating visibility on a scroll-triggered animation made a landing section render as a pure black void in headless/full-page capture — content existed in the DOM at opacity 0 and the trigger never fired. Fix: animate transform only (`initial={{ y: 16 }}`), never opacity-from-zero. Codified in `DESIGN.md` under Motion.

**3. `Claude_Preview.preview_screenshot` for below-the-fold verification. Unreliable.**
Returned stale all-black frames after `preview_eval` scrolling, even though computed styles and `elementsFromPoint` proved content was visible. Workaround: the gstack browse binary (`~/.claude/skills/gstack/browse/dist/browse`) — `$B goto <url>` then `$B screenshot <path>` — gives correct full-page captures.

**4. Blanket `sed` replacement of hardcoded hex colors. Do it file-by-file, not globally.**
A blanket `#ff6b35` → `var(--cc-accent)` sed corrupted `components/UpgradeDialog.tsx:55` — Razorpay's `theme.color` runs inside a third-party iframe where CSS custom properties don't resolve, silently breaking checkout theming. Exclude third-party SDK config, Google Maps style JSON, and SVG data-URI strings from any bulk color sweep. **This exact mistake pattern recurred in a smaller form in PR #29** (a fresh literal hex introduced instead of reusing an existing token) — worth an explicit check on any future hover/style refactor: grep the diff for new `#[0-9a-fA-F]{6}` literals before merging.

**5. Relying on Bash cwd persisting correctly across a multi-worktree repo.**
This repo has 3 git worktrees (see Environmental Notes). A `cd` into one **persists across all subsequent Bash calls in the same session** — there is no auto-return to the original directory. This has already caused one accidental `git pull` inside the wrong worktree (harmless fast-forward that time, but it could easily not be). **Run `pwd` before any git state-changing command**, every time, no exceptions.

**6. Do not delete branches or merge stray branches into main without an explicit, specific ask.**
A prior "clean up pending changes" request was nearly interpreted as "merge every branch that shows as unmerged." Most of those 20+ branches are stale pointers to *already-merged* PRs — their diffs are dominated by deletions because they're behind `main`, not ahead of it. Verify with `git rev-list --count main..$branch` vs `git rev-list --count $branch..main` before treating anything as "pending." The user has since explicitly asked twice to leave all stale branches alone, including `local-backup`. Do not act on branch cleanup unless asked again, specifically, in-session.

## Key Decisions & Assumptions

- **Kept `#ff6b35` orange.** Brand equity; the redesign changed everything around it, not the accent itself.
- **General Sans (Fontshare, free license) over Fraunces.** Confident grotesk, low taste risk. Variable font = one 38KB file for all weights.
- **Two component directories, deliberately:** `components/ui/` = stock shadcn (Tailwind-theme tokens), `components/cc/` = brand primitives (`--cc-*` tokens). Do not merge them. Reach for `cc/` first for anything user-facing.
- **`.section-dark` / `.section-light` are fixed bands, not theme-following.** Headlines inside them use `color: inherit` via an explicit override in `globals.css` — without it the landing hero went invisible in light mode. Verify any new headline in a fixed band in *both* themes.
- **Admin is email-based** (`ADMIN_EMAIL` server-side, `NEXT_PUBLIC_ADMIN_EMAIL` client-side), not a DB role column. Single-admin only.
- **Feature flags are public-readable** by design. Client caches in-memory; admin toggles call `invalidateFlagCache()`. **Still-unverified assumption:** other tabs/sessions won't see a flag change until reload.
- **`components/RestaurantView.tsx:185` `onMouseEnter` is behavioral, not stylistic.** PR #29 correctly left it alone. Do not "clean it up" in a future hover-handler pass.
- **Stale branches are being kept on purpose, not by oversight.** User has declined cleanup twice. Do not treat their presence as an outstanding task.

## Next Steps

There is no in-progress code. Pick any of these; none blocks the others:

1. **Visually QA the signed-in chat surface** — still the single biggest unverified claim in this project. Start the dev server via `preview_start` (name: `dev`; note port 3000 may be occupied by a leftover process — `.claude/launch.json` has `"autoPort": true` so it'll pick a free port, use whatever it reports), sign in with Google, then on `/chat` confirm: time-aware greeting shows first name; avatar menu opens on click *and* touch, closes on Escape/outside-click; AI replies render unbubbled in the centered column; recipe/restaurant cards use the wider lane; scroll-to-bottom pill appears after scrolling up; Regenerate refires the last prompt; composer sits above `BottomNav` on mobile width.
2. **Resolve the duplicate settings surface** (see Open Questions for the decision needed first). If consolidating: repoint `app/api/swiggy/auth/callback/route.ts:78` and the 3 `<Link>`s in `components/SwiggyExpiryBanner.tsx` at `/settings?tab=notifications`, update `app/planner/page.tsx:78` and `app/api/notifications/push/test/route.ts:36`, fix the "Reconnect in Settings → Notifications" error string in `app/chat/page.tsx`, then delete `app/settings/notifications/page.tsx`.
3. **Decide on `#0a84ff`** — promote to a `--cc-info` token and document in `DESIGN.md`, or replace it. Used in `app/admin/page.tsx`, `app/arena/page.tsx`, `components/RecipeView.tsx`, `components/SwiggyExpiryBanner.tsx`, `components/planner/{CoachPanel,MacroBars}.tsx`.
4. Optional, low priority: drop unused `refresh_token`/`client_id` columns from `swiggy_tokens`; delete the empty `design-md/` directory (contains only `.DS_Store`).

## Open Questions

- **Should `/settings/notifications` be deleted or kept as a deep-link target?** Still genuinely load-bearing (OAuth callback lands there). Needs a decision before anyone deletes it — unchanged from last time, still unanswered.
- **What triggers enabling `mcp_instacart` / `mcp_zomato`?** Placeholders with no integration behind them; unknown whether either provider has a usable MCP endpoint. `mcp_swiggy` is blocked per Dead End #1.
- **Is `#0a84ff` an intentional info color or leftover drift?** Predates this work; still no user input.
- **Is single-admin-by-email sufficient long term?**
- **Should the 27 stale local branches / `local-backup` ever be cleaned up?** User has declined twice. If asked a third time, offer tagging `local-backup` before any deletion — it's the only one with genuinely unrecoverable content.

## Environmental Notes

- **Branch: `main`, at `76c432e`, synced with `origin/main`. Working tree fully clean.**
- **Three git worktrees exist — this is the biggest footgun in this repo.** `git worktree list`:
  - `/Users/vijaypanwar/Projects/create-shop-crave-main` → `main` (repo root; work here)
  - `.../.claude/worktrees/interesting-bardeen-1fe2f0` → `claude/awesome-nightingale-f467b4` (already merged as PR #29 — this worktree is now stale and can be removed with `git worktree remove` if it gets in the way)
  - `.../.claude/worktrees/stupefied-meitner-4cc851` → `feat/swiggy-polish` (stale, already merged as #25)

  A `cd` into a worktree **persists across Bash calls indefinitely**. Always `pwd` before any git state-changing command — see Dead End #5.
- **`.claude/` is now gitignored** (this session's change), so it will no longer show as untracked, but it's still on disk and still contains the worktrees above.
- **Env vars required** (in `.env.local`, not in repo): `ADMIN_EMAIL`, `NEXT_PUBLIC_ADMIN_EMAIL`, plus Supabase / Gemini / Maps / Razorpay / Twilio keys. See `.env.example`.
- **Supabase project:** `lxaaclelfhjmqrhdqzxp` (`crave-and-create`, ap-south-1), reachable via Supabase MCP tools. `feature_flags` migration is already applied — verify with a `select` before running any migration file.
- **Verification commands:** `npx tsc --noEmit` passes on `main` as of this writing. No test suite — lint and build are the only automated gates.
- **No open PRs.** All work through PR #31 is merged.
