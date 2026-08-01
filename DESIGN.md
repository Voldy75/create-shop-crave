# Design System — meshi (Crave & Create)

Source of truth: Claude Design project `bdb767d1-b7ae-42ab-b6ce-30542fa2e99f`
("Meshi Kitchef redesign"), read via the `DesignSync` MCP.

Vendored into this repo as:

| File | Role |
|---|---|
| `design/meshi-b.css` | **The design system.** Tokens, type scale, component classes. Consumed by BOTH the web and mobile trees. |
| `design/meshi-web.css` | Desktop-only layer on top: sidebar / topbar / rail shell. Mobile must not load it. |
| `components/mascots/*` | 13 mascot SVGs as React components. |

Because a single file backs both surfaces, "one design system across web and
mobile" is satisfied by construction rather than by convention.

## Product context

AI food companion — one chat turns a craving into a recipe (with grocery
links), nearby restaurants (map + rides), or delivery. Home cooks and foodies,
India-first (Swiggy/Zomato/Blinkit) plus US (Instacart/Uber). Mostly mobile,
mostly Android.

## Migration status

This system **replaces** the previous "Midnight Kitchen" (`--cc-*`) tokens and
the old `app/(mobile)/m/meshi.css`. That replacement is in progress:

- ✅ Assets vendored (`design/`, `components/mascots/`)
- ⬜ Mobile surfaces converted (`app/(mobile)/m/**`)
- ⬜ Web surfaces converted (`app/(web)/**`)
- ⬜ `--cc-*` retired from `app/globals.css`

**Until the last item is done, both vocabularies exist in the repo.** They do
not collide today only because `design/*.css` is not yet imported by either root
layout. Do not add a global import of `meshi-b.css` before converting the
surface that would inherit it — the two systems claim the same class names
(`.card`, `.chip`, `.row`, `.input`, `.badge`, `.tabbar`, `.pill-primary`) and
cannot coexist in one tree.

Exit criterion, mechanical: `grep -rn '\-\-cc-' app components` returns zero.

## Aesthetic direction

Warm cream base, pastel section tints, deep vegetable accents. Chunky, tactile,
sticker-like. Editorial food photography against flat illustrated characters.

## Color

All values live in `design/meshi-b.css`. Never hardcode a hex in a component.

| Token | Value | Use |
|---|---|---|
| `--m-cream` | `#FBF6E3` | app background |
| `--m-cream-2` | `#F4ECD2` | inset / pressed |
| `--m-card` | `#FFFDF4` | raised card |
| `--m-ink` | `#4B2E12` | primary text (chocolate) |
| `--m-ink-soft` | `#8A6B47` | secondary text |
| `--m-forest` | `#1E5A34` | **primary action** |
| `--m-plum` | `#5C2B67` | secondary accent |
| `--m-burnt` / `--m-orange` | `#C05F16` / `#F19A2E` | streaks, ratings |
| `--m-lime` | `#9BCF37` | likes, success, highlights |
| `--m-red` | `#D9453A` | **destructive only** |
| tints | `--m-tint-green/lav/peach` | section backgrounds |

**Light-first.** `:root` is the light palette; dark is a token pass under
`[data-theme="dark"]`. This is the inverse of the old system — `ThemeContext`
defaults to `dark` today and must flip as part of the conversion.

**The orange is retired.** `#ff6b35` was previously kept for brand equity; this
system replaces it with forest green. It reaches beyond CSS — all three of these
must change together:

- `components/UpgradeDialog.tsx` → Razorpay `theme.color`
- `scripts/gen-resources.mjs` → generated icon/splash background
- the `assets` npm script → `--iconBackgroundColor`

…and `resources/*.png` must be regenerated afterwards.

## Typography

**Montserrat** everywhere (display + body), weights 400/500/600/700/800 plus
italic 600. Load via `next/font/google` — Next downloads and self-hosts it at
build time, which is how `DM_Sans` is already wired in the mobile layout. Do not
add a `<link>` to fonts.googleapis.com.

Scale is defined as classes in `meshi-b.css`: `.t-d1`, `.t-d2`, `.t-h1`,
`.t-h2`, `.t-body`, `.t-body-soft`, `.t-cap`, `.t-micro`.

General Sans and Geist are retired with the old system. Never SF Pro
(unlicensed off-Apple, invisible on Android).

## Layout

- Radius: `--m-r-card` 20px, `--m-r-tile` 16px, `--m-r-pill`.
- Spacing scale `--m-s-1..7`.
- Elevation: `--m-shadow` (hard 2px offset), `--m-shadow-lift` (hover).
- **Web shell** (`meshi-web.css`): 250px sidebar + 74px topbar + 336px right
  rail. This is a restructure, not a re-skin — the current web app has no
  sidebar and shares `BottomNav` with mobile. `BottomNav` becomes mobile-only.

⚠️ **`.win`, `.win-bar`, `.win-url`, `.win-body` are the mockup's fake browser
chrome.** They exist so the design file can show the app inside a pretend
browser window. They must never appear in `app/**`. This is the single most
likely mistake in the whole conversion.

## Components

Classes come from `meshi-b.css`: `.card`, `.pill-primary`/`-secondary`/`-lime`/
`-plum`, `.chip`, `.badge`, `.row`, `.input`, `.progress`, `.toast`,
`.streak-chip`, `.rating`, `.tabbar`/`.tab`, `.mascot-tile`.

Reach for these before writing an inline-styled element. `components/cc/*` is
the old primitive set and is superseded — reimplement against `--m-*` or delete
as each surface converts.

## Motion

- **Chunky sticker press.** Primary buttons sit on a hard `0 5px 0` bottom
  shadow and `translateY(4px)` on `:active`, with
  `cubic-bezier(.34,1.56,.64,1)`. This is the signature interaction; keep it.
- `.pill-attn` — slow 2s pulse for a single hero CTA. Use sparingly.
- `.pill-float` — bottom-anchored action that slides up.
- Hover states are **CSS classes**, never `onMouseEnter` style mutation.
- **Never animate opacity from zero on scroll reveal.** Gating visibility on a
  scroll trigger renders as a blank void in headless capture and for anyone
  without JS. Animate transform only. The current landing page still violates
  this (`initial={{ opacity: 0 }}`) and should be fixed during conversion.
- `prefers-reduced-motion` is respected globally.

## Mascots

13 characters in `components/mascots/`. **Bo** (`BoBowl`) is the primary AI
action in both shells — the raised `.tab-bo` button on mobile, `.side-bo` in the
web sidebar.

`.mascot-locked` (grayscale, 38% opacity) implies unlockable mascots. That is a
gamification feature with a data model behind it — until that is decided, treat
it as a disabled style only.

## Imagery

Real food photography for dishes (`lib/food-images.ts`, keyword → TheMealDB).
**Do not apply dish photos to ingredient-level tiles** — a photo of a finished
curry is misleading next to "Tomato passata". Ingredients use mascot tiles.

Duotone gradient overlays (`.duo-forest`, `.duo-plum`, `.duo-orange`) keep
titles legible over photography.

## Hardcoded hex — the allowlist

CI should fail on new `#rrggbb` / `rgba()` literals in `app/**` and
`components/**`. Legitimate exceptions:

- `components/mascots/*` — brand art; the hex *is* the artwork
- Razorpay SDK `theme.color` — runs in a third-party iframe where CSS custom
  properties do not resolve
- Google Maps style JSON
- Partner brand colours (Blinkit yellow, Swiggy orange, Zomato red)
- SVG data-URI strings

A blanket `sed` over hex has already broken this codebase once — it corrupted
the Razorpay iframe theme. Convert file by file.

## Decisions log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-08 | Midnight Kitchen, General Sans + Geist | SF Pro unlicensed + invisible on Android; Apple-clone identity; no appetite appeal |
| 2026-08-02 | **Superseded by meshi Kitchef** | Light-first cream over dark-first charcoal; forest green replaces the orange as primary; Montserrat replaces General Sans + Geist + DM Sans; one shared token file for web and mobile |
| 2026-08-02 | Mobile conversion replaces `meshi.css` wholesale rather than merging | The two systems claim the same class names, so they cannot coexist in one tree |
