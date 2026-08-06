"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { useUser } from "@/app/context/UserContext";
import { AuthButton } from "@/components/AuthButton";
import { MapPin, Loader2, AlertCircle, ArrowRight, Check, ChevronDown, Plus, Minus, ShoppingCart, Car, Star, Clock } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Section } from "@/components/cc/section";
import { Chip } from "@/components/cc/chip";
import { BoBowl } from "@/components/mascots";

const DIETARY_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Nut-Free",
  "Halal",
  "Keto",
];

const FEATURES = [
  {
    title: "Recipe Generator",
    desc: "Get a full recipe with nutrition info, prep time, and step-by-step instructions tailored to your taste.",
    detail: "Our AI understands complex preferences — \"something spicy but low-carb\" or \"a 20-minute vegan dinner for two.\" Every recipe includes per-serving nutrition estimates, ingredient quantities with prices, and clear instructions.",
    visual: "image-plate",
  },
  {
    title: "Ingredient Delivery",
    desc: "One tap to order every ingredient on Blinkit, Swiggy Instamart, or Instacart. No list-making.",
    detail: "Each ingredient links directly to your preferred grocery platform with the right search query pre-filled. We also generate a \"Buy All\" button that adds everything to your cart at once.",
    visual: "mock-cart",
  },
  {
    title: "Restaurant Finder",
    desc: "We find the best nearby restaurants on a live map with Zomato and Swiggy links.",
    detail: "Using your location, we surface restaurants serving exactly what you’re craving — complete with ratings, cuisine tags, price ranges, and deep links to order delivery or view the menu on Zomato and Swiggy.",
    visual: "image-spread",
  },
  {
    title: "Ride Booking",
    desc: "One tap to open Uber or Ola with the restaurant pre-filled as your destination.",
    detail: "When you choose a restaurant, we generate deep links to Uber and Ola with your current location as pickup and the restaurant as drop-off. You also get Google Maps directions as a backup.",
    visual: "mock-ride",
  },
] as const;

const HOW_IT_WORKS = [
  { step: "01", title: "Tell us what you crave", desc: "Type anything — a dish, a mood, a cuisine, dietary preferences. Our AI understands natural language, so just talk like you would to a friend." },
  { step: "02", title: "Get your options instantly", desc: "In seconds, we return a full recipe with shopping links, or 3+ nearby restaurants with maps and ride options — or both. You choose what fits your mood." },
  { step: "03", title: "Cook, order, or go out", desc: "One tap to buy all ingredients on Blinkit, order delivery on Swiggy, or book an Uber to the restaurant. From craving to eating in minutes." },
];

const DEMO_MESSAGES = [
  { role: "user", text: "I’m craving butter chicken but want to cook it at home. Something rich and creamy." },
  { role: "ai", text: "Here’s a restaurant-style Butter Chicken recipe — rich, creamy, and ready in 45 minutes." },
  { role: "recipe", name: "Butter Chicken (Murgh Makhani)", meta: "45 min · 4 servings · 520 cal", tags: ["Gluten-Free", "High Protein"] },
  { role: "ai", text: "I’ve also found 3 restaurants near you serving butter chicken, with Zomato links and ride booking." },
];

const STATS = [
  { value: "50+", label: "Cuisines supported", desc: "From Indian to Italian, Thai to Mexican" },
  { value: "6", label: "Platforms integrated", desc: "Blinkit, Swiggy, Zomato, Uber, Ola, Instacart" },
  { value: "<10s", label: "Average response time", desc: "Full recipe with links in seconds" },
  { value: "24/7", label: "Always available", desc: "Craving at 2 AM? We’re here" },
];

const FAQS = [
  {
    q: "Is Crave & Create free to use?",
    a: "Yes! You get 2 free AI requests per day. For unlimited access, you can upgrade to Pro or bring your own API key from Google, OpenAI, or Anthropic.",
  },
  {
    q: "Which cities and countries does this work in?",
    a: "The recipe generator works worldwide. Restaurant finding and ingredient delivery work best in India (Blinkit, Swiggy, Zomato, Ola) and the US (Instacart, Uber). We’re expanding to more platforms.",
  },
  {
    q: "How does the AI know what I want?",
    a: "We use Google’s Gemini AI to understand your natural language requests. You can describe a mood (\"something comforting\"), a constraint (\"keto dinner under 30 min\"), or a specific dish. The AI also remembers your dietary preferences across sessions.",
  },
  {
    q: "Do I need to create an account?",
    a: "Yes, a free Google sign-in is required so we can save your preferences, favorites, and meal plans. We never share your data with third parties.",
  },
  {
    q: "Can I save recipes and plan meals?",
    a: "Absolutely. Save any recipe or restaurant to your Favorites, and use the Meal Planner to organize your week with a consolidated shopping list across all planned meals.",
  },
];

const PLATFORMS = ["Blinkit", "Swiggy", "Zomato", "Uber", "Ola", "Instacart"];

const TESTIMONIALS = [
  { text: "I used to spend 20 minutes deciding what to eat. Now I just tell Crave & Create my mood and it handles everything.", name: "Priya S.", role: "Home cook, Mumbai" },
  { text: "The ingredient delivery links are a game-changer. I go from recipe to Blinkit cart in literally one tap.", name: "Arjun M.", role: "Student, Delhi" },
  { text: "Finally an app that understands ‘something healthy but not boring.’ The AI suggestions are surprisingly good.", name: "Sneha R.", role: "Fitness enthusiast, Bangalore" },
];

/* Small product-mock vignettes used in the feature rows */
function MockCart() {
  const items = [
    { name: "Chicken thighs", qty: "500 g", price: "₹240" },
    { name: "Butter", qty: "100 g", price: "₹62" },
    { name: "Heavy cream", qty: "200 ml", price: "₹85" },
    { name: "Kasuri methi", qty: "1 pack", price: "₹30" },
  ];
  return (
    <div className="w-full max-w-[360px] rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5 shadow-[var(--cc-shadow-md)]">
      <div className="flex items-center gap-2 mb-4">
        <ShoppingCart className="w-4 h-4 text-[var(--cc-accent)]" />
        <span className="text-[13px] font-semibold text-[var(--cc-text-primary)]">Everything for Butter Chicken</span>
      </div>
      <div className="space-y-2.5">
        {items.map((it) => (
          <div key={it.name} className="flex items-center justify-between text-[13px]">
            <span className="text-[var(--cc-text-secondary)]">{it.name} <span className="text-[var(--cc-text-tertiary)]">· {it.qty}</span></span>
            <span className="text-price font-medium text-[var(--cc-text-primary)]">{it.price}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center rounded-[var(--cc-radius-pill)] bg-[var(--cc-accent)] py-2.5 text-[13px] font-semibold text-white">
        Buy all on Blinkit →
      </div>
    </div>
  );
}

function MockRide() {
  return (
    <div className="w-full max-w-[360px] rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5 shadow-[var(--cc-shadow-md)]">
      <div className="flex items-center gap-2 mb-4">
        <Car className="w-4 h-4 text-[var(--cc-accent)]" />
        <span className="text-[13px] font-semibold text-[var(--cc-text-primary)]">Ride to Punjab Grill</span>
      </div>
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex flex-col items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--cc-accent)]" />
            <span className="w-px h-6 bg-[var(--cc-border-strong)]" />
            <span className="w-2 h-2 rounded-full border border-[var(--cc-text-tertiary)]" />
          </div>
          <div className="space-y-3 text-[13px]">
            <p className="text-[var(--cc-text-secondary)]">Your location</p>
            <p className="text-[var(--cc-text-primary)] font-medium">Punjab Grill, Koramangala</p>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-[var(--cc-surface-2)] px-4 py-3 text-[13px]">
          <span className="flex items-center gap-1.5 text-[var(--cc-text-secondary)]"><Clock className="w-3.5 h-3.5" /> 12 min away</span>
          <span className="text-price font-semibold text-[var(--cc-text-primary)]">₹184</span>
        </div>
        <div className="flex gap-2">
          <span className="flex-1 rounded-[var(--cc-radius-pill)] bg-[var(--cc-accent)] py-2 text-center text-[12px] font-semibold text-white">Book Uber</span>
          <span className="flex-1 rounded-[var(--cc-radius-pill)] border border-[var(--cc-border-strong)] py-2 text-center text-[12px] font-semibold text-[var(--cc-text-primary)]">Book Ola</span>
        </div>
      </div>
    </div>
  );
}

function FeatureVisual({ kind }: { kind: (typeof FEATURES)[number]["visual"] }) {
  if (kind === "image-plate" || kind === "image-spread") {
    const src = kind === "image-plate" ? "/images/hero-indian.webp" : "/images/food-spread.webp";
    const alt = kind === "image-plate" ? "Curry with naan on a plate" : "Three plated dishes seen from above";
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-[var(--cc-shadow-md)]">
        <Image src={src} alt={alt} fill sizes="(max-width: 768px) 100vw, 480px" className="object-cover" />
        {kind === "image-spread" && (
          <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-[var(--cc-radius-pill)] bg-[rgba(12,10,9,0.82)] px-3.5 py-2 backdrop-blur">
            <Star className="w-3.5 h-3.5 text-[#ff9f0a]" fill="#ff9f0a" />
            <span className="text-[12px] font-semibold text-white">4.6 · Punjab Grill · 1.2 km</span>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl bg-[var(--cc-surface-2)] p-6">
      {kind === "mock-cart" ? <MockCart /> : <MockRide />}
    </div>
  );
}

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
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center font-semibold text-xs bg-[var(--cc-accent)] text-white">
            C
          </div>
          <span className="text-[14px] text-[var(--cc-text-primary)] tracking-[-0.01em]">
            Crave &amp; Create
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => setShowAuthCard(true)}
            className="text-[12px] text-[var(--cc-text-primary)] bg-transparent border-none cursor-pointer hover:opacity-70 transition-opacity"
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
      <section className="relative overflow-hidden section-light px-6 pt-14 pb-20 md:pt-20 md:pb-28">
        <div className="mx-auto grid max-w-[1100px] items-center gap-12 md:grid-cols-2">
          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            className="space-y-6 text-center md:text-left"
          >
            <div className="inline-flex items-center gap-2 rounded-[var(--cc-radius-pill)] border border-[rgba(255,107,53,0.2)] bg-[rgba(255,107,53,0.12)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--cc-accent)]">
              AI-Powered Food Companion
            </div>

            <h1 className="headline-hero">
              Discover. <span className="text-[var(--cc-accent)]">Cook.</span> Order.
            </h1>

            <p className="mx-auto max-w-[520px] text-[19px] leading-[1.4] text-[var(--cc-text-secondary)] md:mx-0">
              Tell us what you&apos;re craving. We&apos;ll find a recipe with ingredient delivery, or the best nearby restaurant with a ride booked &mdash; all from one conversation.
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
                  See how it works
                </button>
              </motion.div>
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
            className="relative mx-auto w-full max-w-[480px]"
            aria-hidden="true"
          >
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl shadow-[var(--cc-shadow-lg)]">
              <Image
                src="/images/hero-curry.webp"
                alt=""
                fill
                priority
                sizes="(max-width: 768px) 100vw, 480px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[rgba(12,10,9,0.85)] via-[rgba(12,10,9,0.15)] to-[rgba(12,10,9,0.25)]" />
            </div>

            {/* Floating chat exchange */}
            <div className="absolute inset-x-4 bottom-4 space-y-2.5 md:inset-x-6 md:bottom-6">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-[16px_16px_4px_16px] bg-[var(--cc-accent)] px-4 py-2.5 text-[13px] leading-snug text-white shadow-[var(--cc-shadow-md)]">
                  I&apos;m craving butter chicken tonight
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-[4px_16px_16px_16px] bg-[rgba(28,25,23,0.92)] px-4 py-3 shadow-[var(--cc-shadow-md)] backdrop-blur">
                  <p className="text-[13px] leading-snug text-[var(--cc-text-primary)]">
                    Recipe ready &mdash; 45 min, 520 cal. Or Punjab Grill is 1.2 km away.
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <span className="rounded-[var(--cc-radius-pill)] bg-[var(--cc-accent)] px-2.5 py-1 text-[10px] font-bold text-white">COOK IT</span>
                    <span className="rounded-[var(--cc-radius-pill)] border border-[rgba(250,249,247,0.3)] px-2.5 py-1 text-[10px] font-bold text-[var(--cc-text-primary)]">ORDER IN</span>
                    <span className="rounded-[var(--cc-radius-pill)] border border-[rgba(250,249,247,0.3)] px-2.5 py-1 text-[10px] font-bold text-[var(--cc-text-primary)]">GO OUT</span>
                  </div>
                </div>
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
          <p className="text-[12px] text-[var(--cc-text-tertiary)] tracking-[-0.01em]">
            Powered by Gemini &middot; Blinkit &middot; Swiggy &middot; Zomato &middot; Uber &middot; Ola
          </p>
          <ChevronDown className="w-4 h-4 animate-bounce text-[var(--cc-text-tertiary)]" />
        </motion.div>

        {/* Auth modal overlay */}
        {showAuthCard && !user && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(12,10,9,0.6)", backdropFilter: "blur(8px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowAuthCard(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="relative w-full max-w-sm rounded-2xl bg-[var(--cc-surface)] p-7 text-left shadow-[var(--cc-shadow-lg)]"
            >
              <button
                onClick={() => setShowAuthCard(false)}
                className="absolute top-3 right-3 rounded-full p-1.5 text-[var(--cc-text-tertiary)] transition-colors hover:bg-[var(--cc-surface-2)]"
                aria-label="Close"
              >
                <Plus className="w-4 h-4 rotate-45" />
              </button>
              <div className="space-y-5">
                <div className="space-y-1">
                  <p className="text-label">Get started</p>
                  <p className="text-[14px] text-[var(--cc-text-tertiary)] tracking-[-0.016em]">
                    2 free requests per day. Bring your own key for unlimited use.
                  </p>
                </div>
                <AuthButton />
              </div>
            </motion.div>
          </div>
        )}
      </section>

      {/* ── Stats — Light band ── */}
      <section className="section-light px-6 py-16">
        <div className="mx-auto max-w-[980px]">
          <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="text-[var(--cc-accent)]" style={{ fontFamily: "var(--font-display-stack)", fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 600, lineHeight: 1.07, letterSpacing: "-0.02em" }}>
                  {s.value}
                </p>
                <p className="mt-1 text-[14px] font-semibold tracking-[-0.016em]">{s.label}</p>
                <p className="mt-0.5 text-[12px] opacity-55">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── See it in action — Dark band ── */}
      <Section
        tone="dark"
        eyebrow="See it in action"
        headline={<>One message. Everything you need.</>}
        subtitle="Just type what you're craving. The AI handles the rest — recipes, ingredients, restaurants, and rides."
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
                  {/* Deeper forest, not the accent: this sits ON a forest
                      band, so --cc-accent would be forest-on-forest. */}
                  <div className="max-w-[85%] rounded-[18px_18px_4px_18px] bg-[var(--m-forest-2)] px-4 py-3 text-[15px] leading-[1.47] tracking-[-0.022em] text-[var(--m-on-deep)]">
                    {msg.text}
                  </div>
                </div>
              )}
              {msg.role === "ai" && (
                <div className="flex justify-start">
                  <div className="flex max-w-[85%] gap-3">
                    {/* Bo, not a generic robot glyph — and the stroke was the
                        retired #ff6b35 hardcoded into the SVG, where no token
                        could reach it. */}
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--m-card)]">
                      <BoBowl width={16} height={16} />
                    </div>
                    <div className="rounded-[4px_18px_18px_18px] bg-[var(--m-card)] px-4 py-3 text-[15px] leading-[1.47] tracking-[-0.022em] text-[var(--m-ink)]">
                      {msg.text}
                    </div>
                  </div>
                </div>
              )}
              {msg.role === "recipe" && (
                <div className="flex justify-start">
                  <div className="ml-9 w-full max-w-[85%] rounded-xl border border-[var(--m-ink-faint)] bg-[var(--m-card)] p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-[var(--m-forest)]" />
                      <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--m-forest)]">Recipe</span>
                    </div>
                    <p className="text-[17px] font-semibold tracking-[-0.022em] text-[var(--m-ink)]">{msg.name}</p>
                    <p className="mt-1 text-[12px] text-[var(--m-ink-soft)]">{msg.meta}</p>
                    <div className="mt-3 flex gap-2">
                      {msg.tags?.map((tag) => (
                        <span key={tag} className="rounded-[var(--cc-radius-pill)] bg-[var(--m-tint-green)] px-2 py-[3px] text-[11px] text-[var(--m-forest)]">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <span className="rounded-[var(--cc-radius-pill)] bg-[#f8d800] px-2.5 py-1 text-[11px] font-semibold text-black">Buy on Blinkit</span>
                      <span className="rounded-[var(--cc-radius-pill)] bg-[#fc8019] px-2.5 py-1 text-[11px] font-semibold text-white">Buy on Instamart</span>
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
        tone="light"
        eyebrow="Everything in one chat"
        headline="From craving to table."
        subtitle="No more switching between recipe apps, delivery apps, and map apps. One conversation covers everything."
        wide
      >
        <div className="space-y-16 md:space-y-24">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`grid items-center gap-8 md:grid-cols-2 md:gap-14 ${i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}
            >
              <FeatureVisual kind={f.visual} />
              <div className="space-y-4">
                <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--cc-accent)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="headline-tile" style={{ color: "inherit" }}>{f.title}</h3>
                <p className="text-[17px] leading-[1.5] opacity-75">{f.desc}</p>
                <p className="text-[14px] leading-[1.6] opacity-55">{f.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── How it works — Dark band ── */}
      <Section tone="dark" eyebrow="How it works" headline={<>Three steps. That&apos;s it.</>}>
        <div id="how-it-works" className="grid gap-10 md:grid-cols-3">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.step}>
              <div className="mb-4 text-[rgba(255,107,53,0.25)]" style={{ fontFamily: "var(--font-display-stack)", fontSize: "56px", fontWeight: 600, lineHeight: 1.07 }}>
                {step.step}
              </div>
              <h3 className="mb-2 text-[21px] font-semibold leading-[1.19] tracking-[-0.01em] text-[var(--cc-text-primary)]">
                {step.title}
              </h3>
              <p className="text-[14px] leading-[1.57] tracking-[-0.016em] text-[var(--cc-text-secondary)]">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Testimonials — Light band ── */}
      <Section tone="light" eyebrow="What people are saying" headline="Loved by home cooks and foodies.">
        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="rounded-2xl bg-white p-7 shadow-[rgba(28,25,23,0.05)_0px_2px_12px]">
              <p className="text-[15px] leading-[1.53] tracking-[-0.022em] text-[#1c1917]">
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="mt-5 border-t border-[rgba(28,25,23,0.07)] pt-4">
                <p className="text-[14px] font-semibold text-[#1c1917]">{t.name}</p>
                <p className="text-[12px] text-[rgba(28,25,23,0.5)]">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Platform strip — Dark band ── */}
      <section className="section-dark px-6 py-14">
        <div className="mx-auto max-w-[980px] space-y-5 text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--cc-text-tertiary)]">
            Integrated with your favourite platforms
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {PLATFORMS.map((name) => (
              <span
                key={name}
                className="rounded-[var(--cc-radius-pill)] border border-[rgba(250,249,247,0.14)] px-5 py-2 text-[15px] font-semibold tracking-[-0.01em] text-[var(--cc-text-secondary)]"
              >
                {name}
              </span>
            ))}
          </div>
          <p className="mx-auto max-w-[480px] text-[14px] tracking-[-0.016em] text-[var(--cc-text-tertiary)]">
            We generate deep links directly into each platform &mdash; no API keys or accounts needed on our end. Just tap and go.
          </p>
        </div>
      </section>

      {/* ── FAQ — Light band ── */}
      <Section tone="light" eyebrow="FAQ" headline="Common questions." className="[&>div]:max-w-[680px]">
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

      {/* ── Bottom CTA — Dark band ── */}
      <section className="section-dark px-6 py-24 text-center md:py-28">
        <div className="mx-auto max-w-[580px] space-y-6">
          <h2 className="headline-hero" style={{ fontSize: "clamp(32px, 5vw, 48px)" }}>
            Your next great meal
            <br />
            <span className="text-[var(--cc-accent)]">starts here.</span>
          </h2>
          <p className="text-[17px] leading-[1.47] tracking-[-0.022em] text-[var(--cc-text-secondary)]">
            Free to try. No credit card required. Just sign in with Google and start exploring.
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

      {/* ── Footer ── */}
      <footer className="section-light px-6 py-8 text-center">
        <p className="text-[12px] tracking-[-0.01em] text-[rgba(28,25,23,0.4)]">
          &copy; {new Date().getFullYear()} Crave &amp; Create &middot; Your personal AI food companion
        </p>
      </footer>
    </main>
  );
}
