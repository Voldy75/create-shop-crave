# Design System — Crave & Create

## Product Context
- **What this is:** AI food companion — one chat turns a craving into a recipe (with grocery links), nearby restaurants (map + rides), or delivery.
- **Who it's for:** Home cooks and foodies, India-first (Swiggy/Zomato/Blinkit) + US (Instacart/Uber). Mostly mobile, mostly Android.
- **Project type:** Consumer web app + marketing landing.

## Aesthetic Direction
- **Direction:** Midnight Kitchen — cinematic dark-first, warm charcoal (never pure black), appetite-driven imagery, one confident orange.
- **Decoration level:** Intentional — food photography and product shots do the decorating; no gradients-as-decoration, no icon-grid clichés.
- **Mood:** A great restaurant at night: dark, warm, appetizing, effortless.

## Typography
- **Display:** General Sans 600 (self-hosted variable font, `app/fonts/`, Fontshare Free Font License) — headlines, stats, hero. Exposed as `--font-display` / `--font-display-stack`.
- **Body/UI:** Geist (via `geist` package) — everything else. Applied on `<body>`; never override with inline font-family.
- **Data/prices:** Geist + tabular-nums (`.text-price`).
- **Never:** SF Pro (unlicensed off-Apple, invisible on Android), Inter/Roboto as primary.
- **Scale:** hero clamp(40–64px)/1.05 · section clamp(28–40px)/1.1 · title 21/1.2 · body 15–17/1.47 · caption 13–14 · label 11 uppercase.

## Color
- **Approach:** Restrained — one accent, warm neutrals, semantic colors only for status.
- **Accent:** `#ff6b35` (hover `#ff5520`). Links: `#ffa06b` dark / `#c2410c` light. Focus ring: `#ff8a4d`.
- **Dark surfaces:** `#0c0a09` → `#1c1917` → `#292524` → `#34302c`. Text `#faf9f7` @ 100/68/45%.
- **Light surfaces:** `#faf7f4` → `#ffffff` → `#f3efe9` → `#e9e3db`. Text `#1c1917`.
- **Semantic:** success `#34c759` · warning `#ff9f0a` · error `#ff453a`.
- **Rule:** components never hardcode hex — tokens (`--cc-*`) only. Exceptions (must stay literal): partner brand colors (Blinkit yellow, Swiggy orange, Zomato red), Razorpay SDK theme, Google Maps style JSON, data-URI marker SVGs.

## Spacing & Layout
- Base unit 4px; comfortable density. Max content width 980px marketing (1200px wide sections) / 768px app columns.
- Radius: sm 6 · md 10 · lg 14 · pill 980 (`--cc-radius-*`).
- Grid-disciplined app screens; editorial alternating rows on marketing pages.

## Components
Reusable primitives live in `components/cc/`:
- `CCButton` — primary/secondary/ghost/destructive pills, sm/md/lg.
- `Chip` — filter pill with active state (wraps the `.chip` utility).
- `StatusPill` — active/pending/off/error status badges.
- `IconBadge` — 36px rounded icon tile.
- `CCCard` — surface/elevated card.
- `Section` — landing band with eyebrow/headline/subtitle slots.

Legacy utilities in `globals.css` (`.btn-pill-*`, `.chip`, `.glass-nav`, `.headline-*`, `.text-*`) are token-based and safe to use. No JS `onMouseEnter` style handlers — use CSS hover classes.

## Motion
- Intentional: entrances 250–400ms ease-out, micro-interactions 100–150ms; transforms/opacity only.
- Content must never be hidden behind scroll triggers — `whileInView` may nudge position, never gate opacity from 0.
- `prefers-reduced-motion` is respected globally.

## Imagery
- Food photography is a design material: dark, warm, appetizing. Self-hosted WebP under `public/images/` via `next/image`.
- Lottie animations self-hosted under `public/lottie/` — no runtime lottie.host dependencies.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-08 | Midnight Kitchen system, General Sans + Geist | /design-consultation audit: SF Pro unlicensed + invisible on Android; Apple-clone identity; no appetite appeal |
