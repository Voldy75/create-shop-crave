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

**Done.** This system replaced the previous "Midnight Kitchen" (`--cc-*`)
tokens and the old `app/(mobile)/m/meshi.css`:

- ✅ Assets vendored (`design/`, `components/mascots/`)
- ✅ Mobile surfaces converted (`app/(mobile)/m/**`)
- ✅ Web surfaces converted (`app/(web)/**`)
- ✅ `--cc-*` retired from `app/globals.css` — the alias layer is gone; every
  call site references `--m-*` directly. Exit criterion, mechanical:
  `grep -rn -- '--cc-' app components` returns zero (comments describing the
  old system in history are the only remaining textual hits, and they're
  written to avoid the literal token shape on purpose — see the note on
  Tailwind's content scanner below).

**`--band-*` is a separate, still-live mechanism — do not confuse it with the
retired aliases.** A handful of tokens (`--band-text-secondary`,
`--band-text-tertiary`, `--band-border-strong`, `--band-accent`,
`--band-accent-hover`) exist in `app/globals.css` so the landing's forest and
plum bands can re-scope text/accent legibility by ancestor selector — forest
cannot be both the band colour and the accent on it. These are not aliases
onto `--m-*`; they're real, honestly-named CSS custom properties with their
own default values, currently reused nowhere outside the landing. Do not
"clean these up" as if they were leftover `--cc-*` scaffolding.

**A hex/rgba CI gate is live and the debt baseline is at ZERO**
(`.github/workflows/design-tokens.yml`, `scripts/check-hex.mjs`). Every
literal in `app/**` and `components/**` is now either a `--m-*` token or
carries an explicit inline `// hex-ok: <why>` marker (or a
`// hex-ok-start` / `// hex-ok-end` block) naming which allowlist entry below
it falls under. `scripts/hex-baseline.json` is an empty ratchet kept for the
case where a large refactor must land mid-conversion — **a non-empty baseline
is now a regression, and `--write-baseline` must never be used to silence a
new violation.**

The screens with no web artboard (admin console, `/favorites`, `/arena`,
`/settings` + sections, plus `FavoriteButton` / `SwiggyExpiryBanner` /
`UsageBadge`) were converted by extending the system rather than copying a
design. Semantic tone mapping, applied consistently across all of them and
matching `components/cc/status-pill.tsx`: **forest = healthy/active/enabled,
burnt = warn/attention, red = error/destructive, plum = info**, with
`--m-lime` reserved for the on-band accent. Where a tinted badge needs
readable text, the formula is `hue 50% mixed into --m-ink` on an `18%` tint of
the same hue — `--m-ink` is chocolate in light and cream in dark, so the label
tracks the theme by construction instead of needing a per-theme override.

**A meta-trap worth knowing before you next edit this file or handoff.md:**
Tailwind's content scanner reads markdown and code comments, not just live
JSX — it doesn't know a bracket-arbitrary-value-shaped string is inside a
backtick-quoted sentence describing a past bug rather than real code. Quoting
an old Tailwind arbitrary-value class verbatim in prose can compile into a
real, unused utility rule, and if the quoted content inside the brackets
isn't valid CSS on its own (an ellipsis standing in for "some value", say)
that rule can be a hard build error, not just noise. Describe old classes in
prose without reproducing the bracket shape at all.

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
`[data-theme="dark"]`. This is the inverse of the old system, and the flip is
**done**: both root layouts now pass `defaultTheme="light"` to `ThemeProvider`.
(`ThemeContext`'s own parameter default is still `"dark"`; that is only a
fallback for a caller that passes nothing, and no caller does. It was a real
bug once — a hardcoded `"dark"` shared by both trees silently overrode mobile's
light default — which is why the value is passed explicitly rather than
assumed.)

**The orange is retired, and as of Phase 10d it is gone repo-wide.** It was
kept for brand equity under the old system; forest green replaces it. It
reached beyond CSS into four places that a token could not touch, all now
done:

- `components/UpgradeDialog.tsx` → Razorpay `theme.color` (a third-party
  iframe, so it must stay a literal)
- `scripts/gen-resources.mjs` → the generated icon/splash, which also stopped
  drawing a letter "C" and now draws Bo
- the `assets` npm script → `--iconBackgroundColor`
- `public/manifest.json` → the PWA `theme_color` and `background_color`, found
  last and still on the old palette at the time

`resources/*.png` were regenerated in the same commit. **They are committed
build output — never change the generator without re-running it**, or source
and output disagree.

Note the `assets` script now runs `@capacitor/assets` through `npx` rather than
depending on it: the package bundles a stale, vulnerable toolchain and has no
fixed release. See handoff.md's "Dependency advisories".

## Typography

**Montserrat** everywhere (display + body), weights 400/500/600/700/800 plus
italic 600. Load via `next/font/google` — Next downloads and self-hosts it at
build time, which is how `DM_Sans` is already wired in the mobile layout. Do not
add a `<link>` to fonts.googleapis.com.

Scale is defined as classes in `meshi-b.css`: `.t-d1`, `.t-d2`, `.t-h1`,
`.t-h2`, `.t-body`, `.t-body-soft`, `.t-cap`, `.t-micro`.

**Display weight is 800, not 600.** Every display line in the web artboards is
`font: 800 <size> Montserrat`, and meshi-b agrees — `.t-d1`/`.t-d2` are 800,
`.t-h1`/`.t-h2` are 700, body is 600. The landing's `.headline-*` classes sat
at 600/500 for a while because those were the General Sans values the palette
flip never revisited: at 600, Montserrat reads as semibold *body*, which made
every heading look underweight beside the design. Tracking is px, not em —
wLa's hero is -1.6px at 56px, and an em value re-tightens as a clamp grows.

**Buttons are meshi's pills**, not the legacy `.btn-pill-*`: `.pill-primary`
(52px, forest), `.pill-secondary` (outline), `.pill-lime` (on a deep band,
where forest cannot be the accent), each with `.pill-sm` at 38px for nav and
dense rows. The legacy classes were 400-weight and pressed with `scale()`
instead of the chunky `translateY` against a hard bottom shadow.

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
- **Mascot idle loops** live in `design/meshi-motion.css`. Every character has
  ONE signature move with its own duration — Bo bobs at 2.4s, carrot wiggles at
  1.6s, chili shakes at 0.9s. Reach for `mascotIdleClass()` in
  `lib/mascot-motion.ts` rather than picking by hand; identical timings make a
  row of mascots read as one mechanical wave instead of a cast.
  **A move animates `transform`, so a static `transform: rotate()` on the same
  element is overwritten.** Put the tilt on a wrapper (see the paywall trio).
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
