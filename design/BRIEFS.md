# Design briefs — boards to add to the meshi design file

Paste one brief at a time into Claude Design. **Each is self-contained on
purpose**: Claude Design cannot see this repo, so every constraint it needs is
restated inline. Written 2026-09-29 from a coverage audit against the live
design file (15 web boards, 13 shipped — see handoff.md).

Two rules apply to all three briefs and are repeated inside each one, because
they are the rules this project has broken most often:

1. **The honest-data rule.** Do not draw a number, rating, price, ETA, count or
   status the product cannot actually produce. Every previous board that did
   (ride fares, match scores, "₹2,990 renews 14 Mar", "cooked twice", carrot
   ratings) had to be dropped during implementation, and one shipped to
   production as a false price before it was caught. If a value would be
   invented, draw the empty/unknown state instead.
2. **Use the existing system.** meshi (light-first cream, forest green primary,
   Montserrat, 800 display weight). Components already exist: `.card`,
   `.pill-primary` / `.pill-secondary` / `.pill-lime`, `.chip` / `.chip-active`,
   `.row`, `.input`, `.progress`, `.badge`, `.utabs`, 13 vegetable mascots plus
   Bo the bowl. Do not invent a parallel component language.

Both themes matter: every screen ships in light and dark, and text must clear
WCAG AA (4.5:1, or 3:1 for large/non-text). Deep hues (forest, plum, brown)
are **dark in both themes**, so they cannot be used as text on dark grounds —
the app has theme-aware text tokens for that.

---

## Brief 1 — Web onboarding / Preferences (highest value)

**Why this is needed.** The mobile app has a 10-step onboarding that collects
location, diet, cuisine tastes, weight goal, a calorie target and a streak
opt-in. The web app has **none of it** — just a sign-in modal. A web-only user
therefore has: cuisine tastes permanently empty (the value is read in four
places and written in none), diet preferences settable only from chips on the
public landing page before sign-in, and no weight goal at all. These feed every
AI prompt, so web users silently get worse recommendations with no way to fix
it. Settings today has exactly three tabs: Account, Connections, Notifications.

**Design two things:**

**(a) A first-run flow for web**, shown once after a new user signs in. Not a
copy of the 10-step phone flow — desktop should ask for less, in fewer steps,
and let the user skip to the app. Must collect, at minimum:
- dietary restrictions (multi-select; existing set: Vegetarian, Vegan,
  Gluten-Free, Dairy-Free, Nut-Free, Halal, Keto)
- hard-no allergies — these are strict filters, visually distinct from tastes
- cuisine tastes (multi-select, soft preference, NOT a filter — the distinction
  matters, the app deliberately keeps them apart so a preference never becomes
  a restriction)
- an optional weight goal: lose / maintain / gain (only three values exist)

**(b) A Preferences tab in Settings** for changing all of the above later,
living alongside Account / Connections / Notifications in the existing tab bar.

**Draw the real states:** nothing selected yet; a skipped step; and the
"preferences already set" state of the settings tab.

**Do not draw:** a progress/completion percentage, a "profile strength" meter,
recommended-for-you counts, or anything implying the app has learned something
it hasn't. Location is a browser permission prompt — draw the before and after,
not a fake map pin. There is no avatar upload anywhere in this product.

---

## Brief 2 — Account deletion and data export

**Why this is needed.** Neither exists anywhere in the product, and the App
Store **requires** account deletion for any app that lets you create an
account, so this blocks the iOS submission. It is also the most destructive
flow in the app, which is exactly the kind that should not be improvised.

**Design, for BOTH web (desktop width) and mobile (390px):**
- the entry point in Settings → Account — deliberately not styled like a
  primary action
- a confirmation step that states **specifically** what is deleted: saved
  recipes, meal logs and streak, nutrition goals, dietary preferences,
  notification subscriptions, and any connected store account (Swiggy). Say
  plainly that it cannot be undone.
- a deliberate confirm gesture — typing the word DELETE, or re-authenticating
- the in-progress and completed states, including where the user lands after
- **a blocked state**: what the user sees if they have an active paid
  subscription. The product sells a 31-day one-time pass, so deletion mid-term
  forfeits remaining days — the screen must say so rather than silently delete.
- **data export**: a request-and-download affordance, with its waiting state.

**Do not draw:** a "we're sorry to see you go" retention offer with a discount
(no discount mechanism exists), a deletion-scheduled countdown unless it is
truly deferred, or an emailed-a-copy promise — email delivery is unverified in
this product.

---

## Brief 3 — Admin console (internal, lower priority)

**Why this is needed.** Six screens — dashboard, users, plans, feature flags,
MCP providers, app config — built by extending the design system rather than
from any board, and **never rendered by anyone**, because admin access has
never been configured. It is the largest undesigned surface in the repo.

**Design a shell plus the six screens**, desktop-only (there is no mobile
admin). What each holds today:
- **Dashboard** — KPI tiles (users, daily actives, estimated MRR, AI requests)
  and a request sparkline
- **Users** — a paginated table with status and platform filters, and a detail
  drawer that can restrict or unrestrict a user and shows an admin-only note
- **Plans** — plan cards with per-provider prices (the same plan has a rupee
  price and a dollar price; both exist and must be shown without implying two
  different products)
- **Flags** — simple on/off toggles
- **MCP providers** — provider rows with their server endpoints, plus which
  env var holds each client id
- **Config** — runtime limits and a health panel showing which keys are set

**This is a tool, not a marketing surface**: density and scan-ability beat
whitespace, and it should look like the same product without borrowing the
consumer screens' photography or mascot warmth. Mascots are appropriate only
in empty states.

**Draw the real states:** empty (this product has single-digit users, so the
tables are genuinely short), loading, a permission-denied state, and a failed
save. **Do not draw:** revenue charts over time (nothing stores that history),
cohort or funnel analytics, audit-log timelines beyond the plain list that
exists, or anything implying more traffic than a product with single-digit
users has.

---

## Not briefs — conversion work, no new design needed

- **`components/ApiKeyDialog.tsx`** — the BYOK key dialog opened from web chat.
  Still entirely pre-meshi (indigo and generic greys, ~30 off-palette utility
  classes). User-facing. Needs converting to meshi, not designing.
- **`/home`, `/cart`, `/arena`** — shipped and on-brand; `/home` is composed
  deliberately (its board was deleted), `/cart` was built to a board that no
  longer exists in the file, and `/arena` never had one. Worth boards only if
  you want them polished.
