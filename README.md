<div align="center">

# Crave & Create

**Discover food. Cook it. Order it. Get there.**

An AI-powered food discovery platform that turns a single craving into a complete experience: personalized recipes with multi-platform grocery links, nearby restaurant suggestions on an interactive map, ride booking, and food delivery.

[Live Demo](https://create-shop-crave.vercel.app) | [Report Bug](https://github.com/Voldy75/create-shop-crave/issues)

</div>

---

## What It Does

You type "I want butter chicken" and get back:

- A **full recipe** with step-by-step instructions, nutrition info, and ingredient links to buy on Blinkit, Swiggy Instamart, or Instacart
- **5 nearby restaurants** plotted on an interactive map with ratings, distance, and ETA
- **One-tap actions**: Directions (Google Maps), book a ride (Uber/Ola), order delivery (Swiggy/Zomato)
- Everything respects your **dietary preferences** (vegan, gluten-free, keto, etc.)

The AI remembers context within a session, so you can follow up with "make it spicier" or "what about veg options?" and the conversation flows naturally.

---

## Features

### AI Chat
- Conversational food discovery powered by Google Gemini 2.5 Flash
- Returns structured recipe + restaurant data, not just text
- Supports BYOK (Bring Your Own Key) for Gemini, OpenAI, or Anthropic
- Rate-limited free tier (2 requests/day), unlimited with Pro or BYOK

### Recipes
- Ingredients with quantities, estimated prices, and shopping links
- Multi-platform grocery: Blinkit, Swiggy Instamart, Instacart
- Step-by-step instructions with inline bold formatting
- Nutrition estimate (calories, protein, carbs, fat)
- Prep time, servings, dietary tags

### Restaurants
- Interactive Google Map with numbered markers synced to card list
- Card-to-pin sync: hover a card, the pin highlights and map pans
- Grouped CTAs by intent: "Go There" (Directions, Uber, Ola) vs "Order In" (Swiggy, Zomato)
- Filter chips: Recommended, Top Rated, Nearest, Price
- Distance and ETA computed from your location (Haversine)
- Mobile: horizontal snap carousel with dot indicators
- Desktop: scrollable card list + sticky map (380px / 1fr split)
- Graceful fallback chain: Google Maps JS API -> iframe Embed -> "Map unavailable" panel

### Meal Planner
- 7-day grid with breakfast, lunch, dinner slots
- Add meals from favorites or type a new dish
- Persisted in localStorage

### Favorites
- Save recipes and restaurants with one tap
- Grid view with quick actions (re-open, get directions, order)
- localStorage persistence across sessions

### Payments
- Razorpay (India, one-time monthly)
- Stripe (Global, subscription)
- Pro unlocks unlimited daily requests

### Other
- Dark/light theme with system preference detection
- PWA-ready with manifest and icons
- Mobile-first bottom navigation
- Share recipes and restaurants via Web Share API
- Admin dashboard with usage analytics
- Toast notifications (Sonner)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.0.7 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS 4, shadcn/ui (Radix primitives) |
| AI | Vercel AI SDK 3.4 + Google Gemini 2.5 Flash |
| Auth | Supabase Auth (OAuth) |
| Database | Supabase (PostgreSQL) |
| Maps | Google Maps JS API (`@react-google-maps/api`) |
| Payments | Razorpay + Stripe |
| Animations | Framer Motion 12, Lottie |
| Icons | Lucide React |
| Fonts | Geist + SF Pro Display (system) |
| Deployment | Vercel |

---

## Architecture

```
app/
  page.tsx                    # Landing page with auth + dietary prefs
  chat/page.tsx               # Main AI chat interface
  planner/page.tsx            # Weekly meal planner
  favorites/page.tsx          # Saved recipes & restaurants
  arena/page.tsx              # Recipe/restaurant comparison (Pro)
  admin/page.tsx              # Usage analytics dashboard
  api/
    chat/route.ts             # AI endpoint (Gemini, rate-limited)
    places/route.ts           # Google Places proxy
    usage/route.ts            # Daily usage counter
    auth/callback/route.ts    # Supabase OAuth callback
    subscribe/
      status/route.ts         # Pro subscription check
      razorpay/route.ts       # Create Razorpay order
      razorpay/verify/route.ts # Verify Razorpay payment
      stripe/route.ts         # Create Stripe checkout
      stripe/webhook/route.ts # Stripe webhook handler
  context/
    UserContext.tsx            # Auth, location, dietary preferences
    ThemeContext.tsx           # Dark/light mode state

components/
  RecipeView.tsx              # Full recipe card with ingredients + instructions
  RestaurantView.tsx          # Interactive map + card list + carousel
  AuthButton.tsx              # OAuth sign-in/out
  ApiKeyDialog.tsx            # BYOK modal (Gemini/OpenAI/Anthropic)
  UpgradeDialog.tsx           # Pro upgrade flow
  UsageBadge.tsx              # Free tier usage counter
  FavoriteButton.tsx          # Save/unsave toggle
  ShareButton.tsx             # Web Share API
  BottomNav.tsx               # Mobile tab bar
  ThemeToggle.tsx             # Dark/light switch
  SkeletonCard.tsx            # Loading placeholder

lib/
  types.ts                    # Shared TypeScript interfaces
  providers.ts                # AI model factory (Gemini, OpenAI, Anthropic)
  deeplinks.ts                # URL builders for all external platforms
  rate-limit.ts               # Daily usage tracking via Supabase RPC
  subscription.ts             # Pro user verification
  storage.ts                  # localStorage helpers (favorites, plans, sessions)
  constants.ts                # App constants (DAILY_LIMIT = 2)
  utils.ts                    # Tailwind cn() utility
  supabase/
    client.ts                 # Browser Supabase client
    server.ts                 # Server Supabase client
    middleware.ts              # Session refresh
```

### Data Flow

```
User types "butter chicken near me"
  -> app/chat/page.tsx (client)
    -> POST /api/chat (server)
      -> Rate limit check (Supabase RPC)
      -> Gemini 2.5 Flash (streamed response)
      -> Structured JSON: { recipe, restaurantSuggestion }
    <- Stream to client
  -> RecipeView renders recipe with Blinkit/Swiggy/Instacart links
  -> RestaurantView renders map + cards with Uber/Ola/Zomato/Swiggy CTAs
```

### External Platform Integration

All external links are deep links built in `lib/deeplinks.ts`. No API keys needed for these, they open the target app/website directly:

| Platform | Type | What Opens |
|----------|------|-----------|
| Blinkit | Grocery | Search for ingredient |
| Swiggy Instamart | Grocery | Search for ingredient |
| Instacart | Grocery | Search for ingredient |
| Swiggy | Food delivery | Search for dish near user |
| Zomato | Food delivery | Search for dish |
| Uber | Ride | Pre-filled pickup/dropoff |
| Ola | Ride | Pre-filled pickup/dropoff |
| Google Maps | Directions | Turn-by-turn to restaurant |

---

## Design System

The UI follows an Apple-inspired dark aesthetic with a warm orange accent.

### Color Tokens

| Token | Dark Mode | Light Mode | Usage |
|-------|-----------|------------|-------|
| `--cc-bg` | `#000000` | `#f5f5f7` | App background |
| `--cc-surface` | `#1d1d1f` | `#ffffff` | Card backgrounds |
| `--cc-surface-2` | `#272729` | `#f0f0f2` | Elevated surfaces |
| `--cc-accent` | `#ff6b35` | `#ff6b35` | Primary CTA, selection |
| `--cc-text-primary` | `#ffffff` | `#1d1d1f` | Headlines, titles |
| `--cc-text-secondary` | `rgba(255,255,255,0.7)` | `rgba(0,0,0,0.56)` | Body text |
| `--cc-text-tertiary` | `rgba(255,255,255,0.48)` | `rgba(0,0,0,0.36)` | Captions, labels |
| `--cc-border` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.06)` | Subtle dividers |
| `--cc-link` | `#2997ff` | `#0066cc` | Links |

### Typography Scale

| Class | Size | Weight | Usage |
|-------|------|--------|-------|
| `.headline-hero` | 48px | 700 | Landing page hero |
| `.headline-section` | 32px | 700 | Section headings |
| `.text-title` | 20px | 700 | Card titles |
| `.text-body` | 15px | 400 | Body text |
| `.text-caption` | 12px | 500 | Meta info |
| `.text-label` | 11px | 700 | Uppercase labels (GO THERE, ORDER IN) |

### Component Patterns

| Pattern | Class | Description |
|---------|-------|------------|
| Glass nav | `.glass-nav` | Frosted glass header with blur |
| Pill button | `.btn-pill-primary` | Rounded orange CTA (980px radius) |
| Outline pill | `.btn-pill-secondary` | Bordered pill button |
| Card | `.cc-card` | Surface background with rounded corners |
| Elevated card | `.cc-card-elevated` | Higher surface with shadow |
| Filter chip | `.chip` | Toggleable pill for filters |

### Spacing & Radius

| Token | Value |
|-------|-------|
| `--cc-radius-sm` | 5px |
| `--cc-radius-md` | 8px |
| `--cc-radius-lg` | 12px |
| `--cc-radius-pill` | 980px |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- A Supabase project
- Google Gemini API key

### Environment Variables

Create a `.env.local` file:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google (AI + Maps)
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_maps_key
GOOGLE_MAPS_API_KEY=your_maps_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_EMAIL=your_email@example.com

# Payments (optional)
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
STRIPE_SECRET_KEY=your_stripe_key
STRIPE_PRO_PRICE_ID=your_stripe_price_id
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# Affiliate IDs (optional)
NEXT_PUBLIC_AFFILIATE_BLINKIT=
NEXT_PUBLIC_AFFILIATE_SWIGGY=
NEXT_PUBLIC_AFFILIATE_INSTACART=
NEXT_PUBLIC_AFFILIATE_ZOMATO=
NEXT_PUBLIC_AFFILIATE_UBER=
NEXT_PUBLIC_AFFILIATE_OLA=
```

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Supabase Setup

The app expects these Supabase tables/functions:

- `usage_log` table: tracks daily API usage per user
- `pro_subscriptions` table: stores Pro subscription status
- `check_and_increment_usage` RPC: atomic rate limit check
- `is_pro_user` RPC: check Pro status

### Google Maps Setup

For the interactive map to work (not just iframe fallback):

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **Maps JavaScript API** and **Places API**
3. Set the API key with HTTP referrer restrictions matching your domain

---

## Deployment

Deploy to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Voldy75/create-shop-crave)

Set all environment variables in the Vercel dashboard. The app auto-deploys on every push to `main`.

---

## Project Structure

```
create-shop-crave/
  app/              # Next.js App Router (pages, API routes, contexts)
  components/       # React components
  lib/              # Utilities, types, external service helpers
  public/           # Static assets, PWA manifest
  .env.local        # Environment variables (not committed)
```

---

## License

MIT

---

<div align="center">

Built by [Vijay Panwar](https://github.com/Voldy75)

</div>
