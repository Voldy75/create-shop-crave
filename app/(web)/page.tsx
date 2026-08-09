"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useUser } from "@/app/context/UserContext";
import { AuthButton } from "@/components/AuthButton";
import { MapPin, Loader2, AlertCircle, ArrowRight, Check, ChevronDown, Plus, Minus, ShoppingCart, ShoppingBag, Sparkles, MessageCircle, LineChart } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Section } from "@/components/cc/section";
import { Chip } from "@/components/cc/chip";
import { BoBowl, Carrot, Broccoli, Tomato, Mushroom } from "@/components/mascots";
import { CarrotRating } from "@/components/mobile/CarrotRating";
import { foodImage } from "@/lib/food-images";

/**
 * Partner brands in the hero's "plugs into" row. These hexes are the
 * partners' own and are on DESIGN.md's allowlist — they are identity, not
 * theme, so they do not follow the palette.
 */
const INTEGRATIONS = [
  { name: "Swiggy", letter: "S", brand: "#FC8019", ink: "#ffffff" },
  { name: "Zomato", letter: "Z", brand: "#E23744", ink: "#ffffff" },
  { name: "Instacart", letter: "I", brand: "#0AAD0A", ink: "#ffffff" },
  { name: "Uber", letter: "U", brand: "#000000", ink: "#ffffff" },
] as const;

const DIETARY_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Nut-Free",
  "Halal",
  "Keto",
];

/**
 * wLa's four feature cards, each led by a tinted icon tile. This replaces four
 * long editorial rows that each carried a `detail` paragraph and a product
 * mock — the artboard trades that depth for scannability, so the `detail`
 * copy and the MockCart/MockRide vignettes are no longer rendered.
 */
const FEATURES = [
  {
    title: "Chat with Bo",
    desc: "Four models, one buddy. Ask in plain words — get a recipe, a plan and a list.",
    icon: MessageCircle,
    tint: "var(--m-tint-lav)",
    ink: "var(--m-plum)",
  },
  {
    title: "Shop in one tap",
    desc: "Bo turns any recipe into a Swiggy Instamart or Instacart cart, then checks out.",
    icon: ShoppingCart,
    tint: "var(--m-tint-green)",
    ink: "var(--m-forest)",
  },
  {
    title: "Find & dine out",
    desc: "Best tables nearby on a live map, with Zomato links and an Uber pre-filled.",
    icon: MapPin,
    tint: "var(--m-tint-peach)",
    ink: "var(--m-burnt)",
  },
  {
    title: "Track effortlessly",
    desc: "Snap a plate or log a bite. Bo does the macros and keeps your streak alive.",
    icon: LineChart,
    tint: "var(--m-tint-green)",
    ink: "var(--m-forest)",
  },
] as const;

const HOW_IT_WORKS = [
  { step: "01", title: "Tell Bo what you crave", desc: "A dish, a mood, a diet — talk to Bo like a friend. It understands “something spicy but light.”" },
  { step: "02", title: "Get options instantly", desc: "A full recipe with a shopping cart, or nearby restaurants with maps and rides — or both." },
  { step: "03", title: "Cook, order or go out", desc: "One tap to buy every ingredient, order delivery, or book a ride. Craving to eating in minutes." },
];

const DEMO_MESSAGES = [
  { role: "user", text: "I’m craving butter chicken but want to cook it at home. Something rich and creamy." },
  { role: "ai", text: "Here’s a restaurant-style Butter Chicken recipe — rich, creamy, and ready in 45 minutes." },
  { role: "recipe", name: "Butter Chicken (Murgh Makhani)", meta: "45 min · 4 servings · 520 cal", tags: ["Gluten-Free", "High Protein"] },
  { role: "ai", text: "I’ve also found 3 restaurants near you serving butter chicken, with Zomato links and ride booking." },
];

const STATS = [
  { value: "50+", label: "Cuisines Bo speaks", desc: "Indian to Italian, Thai to Mexican" },
  { value: "4", label: "AI models, one buddy", desc: "Gemini, GPT-4o, Claude & Grok" },
  { value: "<10s", label: "To a full recipe", desc: "Ingredients, macros & a cart" },
  { value: "1-tap", label: "Grocery checkout", desc: "Bo carts & orders for you" },
];

const FAQS = [
  {
    q: "Is meshi free to use?",
    a: "Yes — 2 free Bo requests a day. Go meshi+ for unlimited chats, or bring your own key from Google, OpenAI or Anthropic and keep it free.",
  },
  {
    q: "Which cities and countries does this work in?",
    a: "The recipe generator works worldwide. Restaurant finding and ingredient delivery work best in India (Blinkit, Swiggy, Zomato, Ola) and the US (Instacart, Uber). We’re expanding to more platforms.",
  },
  {
    q: "How does Bo know what I want?",
    a: "We use Google’s Gemini AI to understand your natural language requests. You can describe a mood (\"something comforting\"), a constraint (\"keto dinner under 30 min\"), or a specific dish. The AI also remembers your dietary preferences across sessions.",
  },
  {
    q: "Do I need an account?",
    a: "Yes, a free Google sign-in is required so we can save your preferences, favorites, and meal plans. We never share your data with third parties.",
  },
  {
    q: "Can I save recipes and plan meals?",
    a: "Absolutely. Save any recipe or restaurant to your Favorites, and use the Meal Planner to organize your week with a consolidated shopping list across all planned meals.",
  },
];

/** Wordmarks for the plum integrations strip, in the partners' own colours. */
const PLATFORM_MARKS = [
  { name: "Swiggy", brand: "#FC8019" },
  { name: "Zomato", brand: "#E23744" },
  { name: "Blinkit", brand: "#F8CE1B" },
  { name: "Instacart", brand: "#0AAD0A" },
  { name: "Uber", brand: "var(--m-on-deep)" },
  { name: "Ola", brand: "#35B44B" },
] as const;

const TESTIMONIALS = [
  { text: "I used to spend 20 minutes deciding what to eat. Now I just tell Bo my mood and it handles everything.", name: "Priya S.", role: "Home cook, Mumbai", carrots: 5 },
  { text: "The grocery links are the killer feature. I go from recipe to Instamart cart in literally one tap.", name: "Arjun M.", role: "Student, Delhi", carrots: 5 },
  { text: "Finally an app that understands ‘healthy but not boring.’ Bo's suggestions are surprisingly good.", name: "Sneha R.", role: "Fitness enthusiast, Bangalore", carrots: 4 },
];

/* Small product-mock vignettes used in the feature rows */
/* The MockCart / MockRide vignettes and FeatureVisual lived here. wLa's
   features section is a 4-up card grid led by tinted icon tiles, with no
   product mocks and no alternating editorial rows, so all three became
   unreachable. Removed rather than left as dead code — they are in git if the
   long-form section ever comes back. */

export default function LandingPage() {
  const {
    user,
    hydrated,
    requestLocation,
    location,
    isLoadingLocation,
    locationError,
    dietaryPreferences,
    setDietaryPreferences,
  } = useUser();
  const router = useRouter();
  const [showAuthCard, setShowAuthCard] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    if (hydrated && user && location) {
      router.replace("/chat");
    }
  }, [hydrated, user, location, router]);

  const toggleDietaryPref = (pref: string) => {
    if (dietaryPreferences.includes(pref)) {
      setDietaryPreferences(dietaryPreferences.filter((p) => p !== pref));
    } else {
      setDietaryPreferences([...dietaryPreferences, pref]);
    }
  };

  const handleGetStarted = async () => {
    if (!location) {
      const success = await requestLocation();
      if (!success) return;
    }
    router.push("/chat");
  };

  if (!hydrated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--cc-bg)]">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--cc-accent)]" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--cc-bg)]">

      {/* ── Glass Nav ── */}
      <nav
        className="glass-nav px-6 flex items-center justify-between sticky top-0 z-50"
        style={{ height: "48px" }}
      >
        {/* Bo and the meshi wordmark, matching wLa's nav and the sidebar the
            signed-in app already uses. The old "C" tile was the retired
            orange. */}
        <div className="flex items-center gap-2.5">
          <BoBowl width={28} height={28} />
          <span className="text-[19px] font-extrabold tracking-[-0.6px] text-[var(--cc-text-primary)]">
            meshi
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => setShowAuthCard(true)}
            className="text-[13px] font-bold text-[var(--cc-text-primary)] bg-transparent border-none cursor-pointer hover:opacity-70 transition-opacity"
          >
            Sign in
          </button>
        </div>
      </nav>

      {/* ── Hero — product-forward, appetite-first ── */}
      {/* Cream, not a deep band — the hero holds the accent CTA and the accent
          headline word, and forest-on-forest makes both disappear. This
          matches artboard wLa, where the hero is cream and the forest bands
          are the strips further down. */}
      <section className="band-cream relative overflow-hidden px-6 pt-14 pb-20 md:pt-20 md:pb-28">
        <div className="mx-auto grid max-w-[1100px] items-center gap-12 md:grid-cols-2">
          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            className="space-y-6 text-center md:text-left"
          >
            {/* The old pill was an orange-on-orange badge; wLa's is a peach
                chip with a spark. */}
            <span className="chip inline-flex items-center gap-2 bg-[var(--m-tint-peach)] text-[var(--m-burnt)] shadow-none">
              <Sparkles className="h-[15px] w-[15px]" />
              AI food buddy · now on desktop
            </span>

            <h1 className="headline-hero">
              Cook what you crave.{" "}
              <span className="text-[var(--cc-accent)]">Bo does the rest.</span>
            </h1>

            <p className="mx-auto max-w-[460px] text-[17px] leading-[1.45] text-[var(--cc-text-secondary)] md:mx-0">
              Tell Bo what you&apos;re hungry for. Get a recipe with a one-tap grocery cart, or the best table nearby with a ride booked &mdash; all from one warm little kitchen on the web.
            </p>

            {!user && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex flex-wrap items-center justify-center gap-4 pt-2 md:justify-start"
              >
                <button
                  onClick={() => setShowAuthCard(true)}
                  className="btn-pill-primary flex items-center gap-2"
                  style={{ padding: "14px 32px", fontSize: "17px" }}
                >
                  Get started free <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
                  className="btn-pill-secondary"
                  style={{ padding: "13px 28px", fontSize: "17px" }}
                >
                  Take the tour
                </button>
              </motion.div>
            )}

            {/* "Plugs into what you already use" — the artboard's integrations
                row. Brand colours are the partners' own and are on DESIGN.md's
                allowlist. */}
            {!user && (
              <div className="flex flex-col items-center gap-2.5 pt-2 md:items-start">
                <span className="t-micro">Plugs into what you already use</span>
                <div className="flex flex-wrap justify-center gap-2 md:justify-start">
                  {INTEGRATIONS.map(({ name, letter, brand, ink }) => (
                    <span key={name} className="chip gap-2">
                      <span
                        className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] text-[11px] font-extrabold"
                        style={{ background: brand, color: ink }}
                        aria-hidden="true"
                      >
                        {letter}
                      </span>
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Signed-in user card */}
            {user && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="mx-auto w-full max-w-sm rounded-2xl bg-[var(--cc-surface)] p-7 text-left shadow-[var(--cc-shadow-lg)] md:mx-0"
              >
                <div className="space-y-5">
                  <div className="flex items-center gap-3 rounded-xl bg-[var(--cc-surface-2)] p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--cc-accent)] text-sm font-semibold text-white">
                      {(user.user_metadata?.full_name || user.email || "U")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="truncate text-[14px] font-semibold text-[var(--cc-text-primary)]">{user.user_metadata?.full_name || user.email}</p>
                      <p className="text-[12px] text-[var(--cc-text-tertiary)]">Signed in</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-label">
                      Dietary preferences <span className="font-normal normal-case">(optional)</span>
                    </label>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Dietary preferences">
                      {DIETARY_OPTIONS.map((pref) => (
                        <Chip
                          key={pref}
                          active={dietaryPreferences.includes(pref)}
                          onClick={() => toggleDietaryPref(pref)}
                          style={{ fontSize: "12px" }}
                        >
                          {pref}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-2 rounded-xl p-3 text-[14px]"
                    style={{
                      background: locationError ? "rgba(255,69,58,0.08)" : "var(--cc-surface-2)",
                      border: locationError ? "1px solid rgba(255,69,58,0.2)" : "none",
                    }}
                  >
                    <MapPin className="w-4 h-4 shrink-0" style={{ color: locationError ? "#ff453a" : "var(--cc-accent)" }} />
                    <span style={{ color: locationError ? "#ff453a" : "var(--cc-text-secondary)" }}>
                      {location ? "Location ready" : locationError ? locationError : "Needed for restaurant suggestions"}
                    </span>
                  </div>
                  {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("error") && (
                    <div className="flex items-center gap-2 rounded-xl p-3 text-[14px]" style={{ background: "rgba(255,69,58,0.08)", color: "#ff453a" }}>
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Sign-in failed. Please try again.</span>
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleGetStarted} disabled={isLoadingLocation} className="btn-pill-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60" style={{ height: "48px", fontSize: "17px" }}>
                      {isLoadingLocation ? (<><Loader2 className="w-4 h-4 animate-spin" /> Locating...</>) : "Start Craving"}
                    </button>
                    {locationError && (
                      <button onClick={() => router.push("/chat")} className="btn-pill-secondary" style={{ height: "48px", padding: "0 20px", fontSize: "14px" }}>Skip</button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Product visual — food photo + floating chat exchange */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative mx-auto w-full max-w-[520px]"
            aria-hidden="true"
          >
            {/* wLa replaces the food photo with a tint-green panel: Bo bobbing
                at the centre, produce scattered around him, and one card
                quoting what he'd actually say. The photo is gone deliberately —
                the brand leads with the character now, not the plate. */}
            <div className="relative flex h-[420px] items-center justify-center overflow-hidden rounded-[34px] bg-[var(--m-tint-green)] md:h-[480px]">
              <BoBowl width={220} height={220} style={{ animation: "mm-bob 2.6s ease-in-out infinite" }} />

              <span className="absolute left-[9%] top-[10%] rotate-[-10deg]"><Carrot width={68} height={68} /></span>
              <span className="absolute right-[11%] top-[12%] rotate-[9deg]"><Broccoli width={62} height={62} /></span>
              <span className="absolute left-[6%] top-[39%] rotate-[7deg]"><Tomato width={52} height={52} /></span>
              <span className="absolute right-[7%] top-[41%] rotate-[-8deg]"><Mushroom width={56} height={56} /></span>

              <div className="card absolute bottom-6 left-1/2 flex w-[86%] max-w-[406px] -translate-x-1/2 items-center gap-3 p-4 shadow-[var(--m-shadow-lift)]">
                <BoBowl width={36} height={36} style={{ flex: "none" }} />
                <span className="t-body">&ldquo;You&rsquo;ve got 620 kcal left — want a 25-min green bowl?&rdquo;</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-14 flex flex-col items-center gap-2"
        >
          {/* The "Powered by …" line used to live here. The hero's own
              integrations row now says the same thing with the partners'
              actual marks, so this was the same list twice in one viewport. */}
          <ChevronDown className="w-4 h-4 animate-bounce text-[var(--cc-text-tertiary)]" />
        </motion.div>

        {/* Auth modal — built to the "Sign in" artboard (w1b).

            w1b is a full standalone page (meshi.app/signin) with a full-bleed
            forest background. There is no dedicated /signin ROUTE in this
            app — every "Sign in" trigger (nav, hero, both CTAs) opens this
            same overlay, and unauthenticated visits to app routes redirect to
            "/" (see app/(web)/(app)/chat/page.tsx), not to a signin path. So
            this stays a modal rather than inventing a page nothing links to;
            what moves to w1b is the CARD — the Bo circle, headline, and
            provider buttons. The scrim is forest-tinted rather than a plain
            black overlay, matching the sheet-scrim pattern already used on
            mobile bottom sheets. */}
        {showAuthCard && !user && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "color-mix(in srgb, var(--m-forest-2) 55%, transparent)", backdropFilter: "blur(8px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowAuthCard(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="card relative flex w-full max-w-[440px] flex-col items-center gap-[13px] p-[34px] text-center md:p-[38px]"
              style={{ boxShadow: "var(--m-shadow-lift)" }}
            >
              <button onClick={() => setShowAuthCard(false)} className="icon-btn absolute right-4 top-4" aria-label="Close">
                <Plus width={16} height={16} style={{ transform: "rotate(45deg)" }} />
              </button>

              <div className="flex h-[104px] w-[104px] items-center justify-center rounded-full" style={{ background: "var(--m-tint-green)" }}>
                <BoBowl width={72} height={72} />
              </div>
              <span className="t-d1">Welcome back</span>
              <span className="t-body-soft">Sign in and Bo picks up right where you left off — streak, plan and all.</span>

              <div style={{ width: "100%", marginTop: 6 }}>
                <AuthButton />
              </div>
            </motion.div>
          </div>
        )}
      </section>

      {/* ── Stats — forest band, lime numerals (wLa) ── */}
      <section className="band-forest band-deep px-6 py-14 md:py-[60px]">
        <div className="mx-auto max-w-[1060px]">
          <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4 md:gap-[26px]">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col gap-[3px]">
                <span className="text-[clamp(34px,5vw,46px)] font-extrabold leading-none tracking-[-1.4px] text-[var(--m-lime)]">
                  {s.value}
                </span>
                <span className="text-[14.5px] font-extrabold text-[var(--m-on-deep)]">{s.label}</span>
                <span className="text-[12px] font-bold leading-[1.35] text-[var(--cc-text-tertiary)]">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── See it in action — CREAM in wLa, not a band ── */}
      <Section
        tone="cream"
        eyebrow="See it in action"
        headline={<>One message. The whole meal, sorted.</>}
        subtitle="Just tell Bo what you're craving. Recipe, groceries, restaurants and macros — handled in the same chat."
      >
        {/* Demo chat — always visible; scroll only nudges position */}
        <div className="mx-auto max-w-[640px] space-y-4">
          {DEMO_MESSAGES.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ y: 16 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              {msg.role === "user" && (
                <div className="flex justify-end">
                  <div className="max-w-[78%] rounded-[20px_20px_6px_20px] bg-[var(--m-forest)] px-[17px] py-[13px] text-[15px] font-semibold leading-[1.45] text-[var(--m-on-deep)]">
                    {msg.text}
                  </div>
                </div>
              )}
              {msg.role === "ai" && (
                <div className="flex items-start gap-3">
                  {/* Bo in a tint disc, per wLa. The glyph here used to be a
                      generic robot with the retired orange hardcoded as a
                      stroke — a colour no token could reach. */}
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--m-tint-green)]">
                    <BoBowl width={28} height={28} />
                  </span>
                  <div className="card max-w-[78%] rounded-bl-[6px] px-[17px] py-[13px]">
                    <span className="t-body">{msg.text}</span>
                  </div>
                </div>
              )}
              {msg.role === "recipe" && (
                <div className="flex items-start gap-3">
                  {/* Spacer keeps the card aligned under Bo's bubbles */}
                  <span className="h-10 w-10 shrink-0" aria-hidden="true" />
                  <div className="card wtile flex max-w-[78%] items-center gap-3.5 p-3">
                    {/* Keyless, from lib/food-images — falls back to the `.ph`
                        gradient when no photo matches, so it is never empty. */}
                    {(() => {
                      const img = msg.name ? foodImage(msg.name) : null;
                      return (
                        <div
                          className={`h-[76px] w-[76px] shrink-0 rounded-[14px] ${img ? "imgfill" : "ph ph-saffron"}`}
                          style={img ? { backgroundImage: `url(${img})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                        />
                      );
                    })()}
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="t-micro text-[var(--m-burnt)]">Recipe</span>
                      <span className="t-h2">{msg.name}</span>
                      <span className="t-cap">{msg.meta}</span>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="chip chip-active h-[30px] px-3 text-[12px]">Cook</span>
                        <span className="chip h-[30px] px-3 text-[12px]">Buy on Instamart</span>
                        <span className="chip h-[30px] px-3 text-[12px]">Dine out</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <button
            onClick={() => { setShowAuthCard(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="btn-pill-primary inline-flex items-center gap-2"
            style={{ padding: "14px 32px", fontSize: "17px" }}
          >
            Try it yourself <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </Section>

      {/* ── Features — editorial alternating rows, Light band ── */}
      <Section
        tone="cream2"
        eyebrow="Everything in one chat"
        headline="From craving to table."
        subtitle="No more juggling a recipe app, three delivery apps and a map. Bo covers the whole journey."
        wide
      >
        {/* wLa replaces the alternating editorial rows with a 4-up card grid,
            each led by a tinted icon tile. */}
        <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="card wtile p-[22px] md:p-[26px]">
                <div
                  className="mb-3.5 flex h-[52px] w-[52px] items-center justify-center rounded-[15px]"
                  style={{ background: f.tint }}
                >
                  <Icon width={26} height={26} style={{ color: f.ink }} />
                </div>
                <span className="t-h1">{f.title}</span>
                <p className="t-body-soft mt-2">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── How it works — forest band, lime numerals (wLa) ── */}
      <Section tone="forest" eyebrow="How it works" headline={<>Three steps. That&apos;s it.</>}>
        <div id="how-it-works" className="grid gap-10 md:grid-cols-3">
          {/* Per-step vignette inside .hiw-mascot, exactly as wLa draws it:
              01 — Bo with a thinking bubble (three staggered dots)
              02 — Bo with a twinkling spark and a carrot popping in and out
              03 — Bo with a lime delivery badge sliding across
              None of .hiw-step/.hiw-mascot/.hiw-bubble/.hiw-badge or the
              mm-bob/mm-dot/mm-twinkle/mm-poploop/mm-deliver keyframes exist in
              the vendored meshi-b.css or meshi-web.css — they are only in the
              .dc.html's own inline <style>, so they are ported into
              globals.css rather than assumed to already work. mm-bob in
              particular had no keyframe anywhere in the web tree until this
              change, so Bo has been static everywhere on this page (hero,
              demo chat, closing CTA too) despite the `animation` prop being
              set the whole time. */}
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.step} className="hiw-step flex flex-col gap-2" style={{ animationDelay: `${i * 0.1 + 0.02}s` }}>
              <div className="hiw-mascot">
                <BoBowl width={50} height={50} style={{ animation: "mm-bob 2.4s ease-in-out infinite" }} />
                {i === 0 && (
                  <span className="hiw-bubble" aria-hidden="true">
                    <i style={{ animation: "mm-dot 1s ease-in-out infinite" }} />
                    <i style={{ animation: "mm-dot 1s .16s ease-in-out infinite" }} />
                    <i style={{ animation: "mm-dot 1s .32s ease-in-out infinite" }} />
                  </span>
                )}
                {i === 1 && (
                  <>
                    <Sparkles
                      width={18}
                      height={18}
                      aria-hidden="true"
                      style={{ position: "absolute", top: 9, right: 12, color: "var(--m-lime)", animation: "mm-twinkle 1.6s ease-in-out infinite" }}
                    />
                    <Carrot
                      width={26}
                      height={26}
                      aria-hidden="true"
                      style={{ position: "absolute", bottom: 6, left: 7, animation: "mm-poploop 2.6s ease-in-out infinite" }}
                    />
                  </>
                )}
                {i === 2 && (
                  <span className="hiw-badge" aria-hidden="true" style={{ animation: "mm-deliver 2.6s ease-in-out infinite" }}>
                    <ShoppingBag width={18} height={18} style={{ color: "var(--m-forest-2)" }} />
                  </span>
                )}
              </div>
              {/* The numeral was rgba(255,107,53,0.25) — the retired orange,
                  baked into a Tailwind arbitrary value. */}
              <span className="hiw-num text-[58px] font-extrabold leading-none tracking-[-1px] text-[color-mix(in_srgb,var(--m-lime)_32%,transparent)]">
                {step.step}
              </span>
              <span className="text-[21px] font-bold text-[var(--m-on-deep)]">{step.title}</span>
              <span className="hiw-bar" aria-hidden="true" />
              <p className="text-[14.5px] font-semibold leading-[1.55] text-[var(--cc-text-secondary)]">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Testimonials — carrot ratings, per wLa ── */}
      <Section tone="cream" eyebrow="What people are saying" headline="Loved by home cooks and foodies.">
        <div className="grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="card p-[26px]">
              <CarrotRating value={t.carrots} size={16} />
              <p className="t-body mt-3 leading-[1.5]">&ldquo;{t.text}&rdquo;</p>
              <div className="mt-[18px] flex items-center gap-[11px] border-t border-[var(--m-ink-faint)] pt-4">
                <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[var(--m-tint-green)] text-[14px] font-extrabold text-[var(--m-forest)]">
                  {t.name.slice(0, 1)}
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="t-h2 text-[14px]">{t.name}</span>
                  <span className="t-cap">{t.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Integrations strip — PLUM in wLa, the one plum band on the page ── */}
      <section className="band-plum band-deep px-6 py-14 md:py-[60px]">
        <div className="mx-auto flex max-w-[1060px] flex-col items-center gap-[22px] text-center">
          {/* One step brighter than wLa's eyebrow, which sits at 60% on plum
              and measures 2.1:1. Secondary takes it past 3:1 at no cost to the
              design's intent. */}
          <p className="t-micro text-[var(--cc-text-secondary)]">
            Integrated with your favourite platforms
          </p>
          {/* Wordmarks in the partners' own colours, separated by dots — the
              artboard's treatment. These hexes are brand identity and are on
              DESIGN.md's allowlist. */}
          <div className="flex flex-wrap items-center justify-center gap-3.5">
            {PLATFORM_MARKS.map(({ name, brand }, i) => (
              <Fragment key={name}>
                {i > 0 && (
                  <span className="h-[5px] w-[5px] rounded-full bg-[var(--cc-border-strong)]" aria-hidden="true" />
                )}
                <span className="text-[22px] font-extrabold tracking-[-0.5px]" style={{ color: brand }}>
                  {name}
                </span>
              </Fragment>
            ))}
          </div>
          <p className="mx-auto max-w-[500px] text-[14px] font-semibold leading-[1.5] text-[var(--cc-text-secondary)]">
            Bo generates deep links straight into each platform &mdash; no extra accounts, no copy-pasting. Just tap and go.
          </p>
        </div>
      </section>

      {/* ── FAQ — Light band ── */}
      <Section tone="cream" eyebrow="FAQ" headline="Common questions." className="[&>div]:max-w-[680px]">
        <div>
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="border-b border-[rgba(28,25,23,0.1)]"
              style={{ borderTop: i === 0 ? "1px solid rgba(28,25,23,0.1)" : "none" }}
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full cursor-pointer items-center justify-between border-none bg-transparent py-5 text-left text-[17px] font-semibold tracking-[-0.022em] text-[#1c1917]"
              >
                <span className="pr-4">{faq.q}</span>
                {openFaq === i ? (
                  <Minus className="w-4 h-4 shrink-0 text-[rgba(28,25,23,0.4)]" />
                ) : (
                  <Plus className="w-4 h-4 shrink-0 text-[rgba(28,25,23,0.4)]" />
                )}
              </button>
              {openFaq === i && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="pb-5"
                >
                  <p className="text-[14px] leading-[1.57] tracking-[-0.016em] text-[rgba(28,25,23,0.62)]">
                    {faq.a}
                  </p>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* ── Closing CTA — forest, with Bo and faded produce (wLa) ── */}
      <section className="band-forest band-deep relative overflow-hidden px-6 py-24 text-center md:py-[96px]">
        {/* Oversized, faded mascots bleeding off the band's edges */}
        <Carrot width={150} height={150} className="pointer-events-none absolute left-[6%] top-10 opacity-[0.12]" aria-hidden="true" />
        <Broccoli width={180} height={180} className="pointer-events-none absolute bottom-9 right-[7%] opacity-[0.12]" aria-hidden="true" />

        <div className="relative mx-auto flex max-w-[600px] flex-col items-center gap-5">
          <BoBowl width={76} height={76} style={{ animation: "mm-bob 2.6s ease-in-out infinite" }} />
          <h2 className="headline-hero" style={{ fontSize: "clamp(32px, 5vw, 46px)" }}>
            Your next great meal
            <br />
            <span className="text-[var(--cc-accent)]">starts here.</span>
          </h2>
          <p className="text-[17px] leading-[1.47] tracking-[-0.022em] text-[var(--cc-text-secondary)]">
            Free to try. No card required. Sign in with Google and start craving.
          </p>
          <button
            onClick={() => { setShowAuthCard(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="btn-pill-primary inline-flex items-center gap-2"
            style={{ padding: "14px 32px", fontSize: "17px" }}
          >
            Get started free <ArrowRight className="w-4 h-4" />
          </button>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 pt-4">
            {["2 free requests/day", "No credit card", "Works on mobile", "Save recipes & plan meals"].map((item) => (
              <div key={item} className="flex items-center gap-1.5 text-[12px] text-[var(--cc-text-tertiary)]">
                <Check className="w-3 h-3 text-[var(--cc-accent)]" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer — wLa's three-part row on cream-2 ── */}
      <footer className="band-cream2 flex flex-col items-center justify-between gap-4 px-6 py-[30px] md:flex-row md:px-12">
        <div className="flex items-center gap-2.5">
          <BoBowl width={26} height={26} />
          <span className="text-[17px] font-extrabold tracking-[-0.4px] text-[var(--m-ink)]">meshi</span>
        </div>
        <span className="t-cap">
          &copy; {new Date().getFullYear()} meshi &middot; Your personal AI food buddy
        </span>
        <div className="flex items-center gap-5">
          {["Privacy", "Terms", "Contact"].map((l) => (
            <span key={l} className="wlink text-[12.5px]">{l}</span>
          ))}
        </div>
      </footer>
    </main>
  );
}
