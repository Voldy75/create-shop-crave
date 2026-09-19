# Crave & Create (meshi)

AI food companion — Next.js 16 App Router, Supabase, Gemini via AI SDK, Vercel,
plus a Capacitor-wrapped iOS/Android shell.

## Start here
- **`handoff.md`** is the live source of truth for project state and pending
  work — read its top section and the pending-work index first. Do not trust a
  commit SHA quoted in it; check `git` yourself.
- **`MOBILE_SETUP.md`** is the ordered native/store checklist.

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

Key rules:
- Colors come from `--m-*` tokens in `design/meshi-b.css` — never hardcode hex
  or rgba in `app/**` or `components/**`. `npm run check:hex` enforces this in
  CI; allowlisted exceptions carry an inline `hex-ok` marker (see DESIGN.md).
  The old `--cc-*` tokens are deleted — never reintroduce them.
- Typography: **Montserrat** everywhere, via `next/font`. Display type is
  weight 800. General Sans, Geist and SF Pro are retired.
- Use meshi's component classes before writing inline-styled UI: `.pill-primary`
  / `.pill-secondary` / `.pill-lime` (+ `.pill-sm`), `.chip` / `.chip-active`,
  `.card`. `components/cc/*` are reskinned wrappers kept for the admin and
  settings screens.
- Two root layouts: `app/(web)` loads `meshi-b.css` + `meshi-web.css` +
  `meshi-motion.css` + `meshi-app.css` + `globals.css`; `app/(mobile)` loads
  `meshi-b.css` + `meshi-motion.css` + `m/mobile.css`. Mascot keyframes belong
  only in `meshi-motion.css`. **A class defined in one tree does not exist in the other** —
  grep the stylesheets that tree actually imports before using one.
- Measure text contrast in BOTH light and dark themes.
- Hover states use CSS classes, not JS onMouseEnter handlers.
- Never quote a Tailwind bracket-arbitrary-value class verbatim in docs or
  comments — the content scanner compiles it and can break the build.

## Gates
No test suite. Before committing: `npx tsc --noEmit`, `eslint`,
`npm run check:hex`, and a build with dummy Supabase env:
`NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy npx next build`.
