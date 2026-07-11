# Crave & Create

AI food companion — Next.js 16 App Router, Supabase, Gemini via AI SDK, Vercel.

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

Key rules:
- Colors come from `--cc-*` tokens in `app/globals.css` — never hardcode hex in components (exceptions listed in DESIGN.md).
- Typography: General Sans (display, `--font-display-stack`) + Geist (body). Never SF Pro.
- Reusable primitives live in `components/cc/` — use them before writing inline-styled buttons/chips/badges.
- Hover states use CSS classes, not JS onMouseEnter handlers.
