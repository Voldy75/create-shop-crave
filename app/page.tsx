"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useUser } from "./context/UserContext";
import { AuthButton } from "@/components/AuthButton";
import { MapPin, Loader2, AlertCircle, ArrowRight, Check, ChevronDown, Plus, Minus } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

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
    detail: "Our AI understands complex preferences \u2014 \"something spicy but low-carb\" or \"a 20-minute vegan dinner for two.\" Every recipe includes per-serving nutrition estimates, ingredient quantities with prices, and clear instructions.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M16 4C16 4 8 8 8 16C8 20.4183 11.5817 24 16 24C20.4183 24 24 20.4183 24 16C24 8 16 4 16 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16 4V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M12 28H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M16 24V28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: "Ingredient Delivery",
    desc: "One tap to order every ingredient on Blinkit, Swiggy Instamart, or Instacart. No list-making.",
    detail: "Each ingredient links directly to your preferred grocery platform with the right search query pre-filled. We also generate a \"Buy All\" button that adds everything to your cart at once.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M6 8H8L10 22H24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="26" r="2" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="22" cy="26" r="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M10 12H26L24 22H10" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: "Restaurant Finder",
    desc: "We find the best nearby restaurants on a live map with Zomato and Swiggy links.",
    detail: "Using your location, we surface restaurants serving exactly what you\u2019re craving \u2014 complete with ratings, cuisine tags, price ranges, and deep links to order delivery or view the menu on Zomato and Swiggy.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M16 28C16 28 26 20 26 13C26 7.47715 21.5228 3 16 3C10.4772 3 6 7.47715 6 13C6 20 16 28 16 28Z" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="16" cy="13" r="3" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    title: "Ride Booking",
    desc: "One tap to open Uber or Ola with the restaurant pre-filled as your destination.",
    detail: "When you choose a restaurant, we generate deep links to Uber and Ola with your current location as pickup and the restaurant as drop-off. You also get Google Maps directions as a backup.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="14" width="24" height="10" rx="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 14V10C8 8.89543 8.89543 8 10 8H22C23.1046 8 24 8.89543 24 10V14" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="9" cy="20" r="1.5" fill="currentColor"/>
        <circle cx="23" cy="20" r="1.5" fill="currentColor"/>
        <path d="M12 24V27" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M20 24V27" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Tell us what you crave", desc: "Type anything \u2014 a dish, a mood, a cuisine, dietary preferences. Our AI understands natural language, so just talk like you would to a friend." },
  { step: "02", title: "Get your options instantly", desc: "In seconds, we return a full recipe with shopping links, or 3+ nearby restaurants with maps and ride options \u2014 or both. You choose what fits your mood." },
  { step: "03", title: "Cook, order, or go out", desc: "One tap to buy all ingredients on Blinkit, order delivery on Swiggy, or book an Uber to the restaurant. From craving to eating in minutes." },
];

const DEMO_MESSAGES = [
  { role: "user", text: "I\u2019m craving butter chicken but want to cook it at home. Something rich and creamy." },
  { role: "ai", text: "Here\u2019s a restaurant-style Butter Chicken recipe \u2014 rich, creamy, and ready in 45 minutes." },
  { role: "recipe", name: "Butter Chicken (Murgh Makhani)", meta: "45 min \u00b7 4 servings \u00b7 520 cal", tags: ["Gluten-Free", "High Protein"] },
  { role: "ai", text: "I\u2019ve also found 3 restaurants near you serving butter chicken, with Zomato links and ride booking." },
];

const STATS = [
  { value: "50+", label: "Cuisines supported", desc: "From Indian to Italian, Thai to Mexican" },
  { value: "6", label: "Platforms integrated", desc: "Blinkit, Swiggy, Zomato, Uber, Ola, Instacart" },
  { value: "<10s", label: "Average response time", desc: "Full recipe with links in seconds" },
  { value: "24/7", label: "Always available", desc: "Craving at 2 AM? We\u2019re here" },
];

const FAQS = [
  {
    q: "Is Crave & Create free to use?",
    a: "Yes! You get 2 free AI requests per day. For unlimited access, you can upgrade to Pro or bring your own API key from Google, OpenAI, or Anthropic.",
  },
  {
    q: "Which cities and countries does this work in?",
    a: "The recipe generator works worldwide. Restaurant finding and ingredient delivery work best in India (Blinkit, Swiggy, Zomato, Ola) and the US (Instacart, Uber). We\u2019re expanding to more platforms.",
  },
  {
    q: "How does the AI know what I want?",
    a: "We use Google\u2019s Gemini AI to understand your natural language requests. You can describe a mood (\"something comforting\"), a constraint (\"keto dinner under 30 min\"), or a specific dish. The AI also remembers your dietary preferences across sessions.",
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

const PLATFORMS = [
  { name: "Blinkit", color: "#f8d800" },
  { name: "Swiggy", color: "#fc8019" },
  { name: "Zomato", color: "#e23744" },
  { name: "Uber", color: "#ffffff" },
  { name: "Ola", color: "#35b44b" },
  { name: "Instacart", color: "#43b02a" },
];

const TESTIMONIALS = [
  { text: "I used to spend 20 minutes deciding what to eat. Now I just tell Crave & Create my mood and it handles everything.", name: "Priya S.", role: "Home cook, Mumbai" },
  { text: "The ingredient delivery links are a game-changer. I go from recipe to Blinkit cart in literally one tap.", name: "Arjun M.", role: "Student, Delhi" },
  { text: "Finally an app that understands \u2018something healthy but not boring.\u2019 The AI suggestions are surprisingly good.", name: "Sneha R.", role: "Fitness enthusiast, Bangalore" },
];

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
  const [expandedFeature, setExpandedFeature] = useState<number | null>(null);

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
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#000000" }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#ff6b35" }} />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "#000000" }}>

      {/* ── Apple Glass Nav ── */}
      <nav
        className="glass-nav px-6 flex items-center justify-between sticky top-0 z-50"
        style={{ height: "48px" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center font-semibold text-xs"
            style={{ background: "#ff6b35", color: "#ffffff" }}
          >
            C
          </div>
          <span style={{ color: "#ffffff", fontSize: "14px", fontWeight: 400, letterSpacing: "-0.01em" }}>
            Crave &amp; Create
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => setShowAuthCard(true)}
            style={{ color: "#ffffff", fontSize: "12px", fontWeight: 400, background: "none", border: "none", cursor: "pointer" }}
            className="hover:opacity-70 transition-opacity"
          >
            Sign in
          </button>
        </div>
      </nav>

      {/* ── Hero — Black, cinematic ── */}
      <section
        className="flex flex-col items-center justify-center text-center relative overflow-hidden"
        style={{ background: "#000000", padding: "60px 24px 80px" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="max-w-[980px] w-full space-y-6"
        >
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2"
            style={{
              padding: "6px 14px",
              borderRadius: "980px",
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              background: "rgba(255,107,53,0.12)",
              color: "#ff6b35",
              border: "1px solid rgba(255,107,53,0.2)",
            }}
          >
            AI-Powered Food Companion
          </motion.div>

          {/* Headline */}
          <h1 style={{
            fontSize: "clamp(40px, 6vw, 56px)",
            fontWeight: 600,
            lineHeight: 1.07,
            letterSpacing: "-0.005em",
            color: "#ffffff",
          }}>
            Discover. <span style={{ color: "#ff6b35" }}>Cook.</span>
            <br />
            Order.
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: "21px",
            fontWeight: 400,
            lineHeight: 1.38,
            letterSpacing: "0.011em",
            color: "rgba(255, 255, 255, 0.7)",
            maxWidth: "580px",
            margin: "0 auto",
          }}>
            Tell us what you&apos;re craving. We&apos;ll find a recipe with ingredient delivery, or the best nearby restaurant with a ride booked &mdash; all from one conversation.
          </p>

          {/* CTAs */}
          {!user && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-wrap items-center justify-center gap-4 pt-2"
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
                style={{
                  padding: "13px 28px",
                  fontSize: "17px",
                  fontWeight: 400,
                  borderRadius: "980px",
                  background: "transparent",
                  color: "#ffffff",
                  border: "1px solid rgba(255,255,255,0.32)",
                  cursor: "pointer",
                  transition: "background 0.15s ease, border-color 0.15s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.48)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.32)"; }}
              >
                See how it works
              </button>
            </motion.div>
          )}

          {/* Auth modal overlay */}
          {showAuthCard && !user && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
              onClick={(e) => { if (e.target === e.currentTarget) setShowAuthCard(false); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-sm text-left relative"
                style={{ background: "#1d1d1f", borderRadius: "12px", padding: "28px", boxShadow: "rgba(0,0,0,0.55) 0px 16px 48px" }}
              >
                <button
                  onClick={() => setShowAuthCard(false)}
                  className="absolute top-3 right-3 p-1.5 rounded-full transition-colors"
                  style={{ color: "rgba(255,255,255,0.48)", background: "transparent" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  aria-label="Close"
                >
                  <Plus className="w-4 h-4 rotate-45" />
                </button>
                <div className="space-y-5">
                  <div className="space-y-1">
                    <p style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.01em", color: "rgba(255,255,255,0.48)" }}>
                      Get started
                    </p>
                    <p style={{ fontSize: "14px", letterSpacing: "-0.016em", color: "rgba(255,255,255,0.48)" }}>
                      2 free requests per day. Bring your own key for unlimited use.
                    </p>
                  </div>
                  <AuthButton />
                </div>
              </motion.div>
            </div>
          )}

          {/* Signed-in user card */}
          {user && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mx-auto w-full max-w-sm text-left"
              style={{ background: "#1d1d1f", borderRadius: "12px", padding: "28px", boxShadow: "rgba(0,0,0,0.55) 0px 16px 48px" }}
            >
              <div className="space-y-5">
                  <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "#272729" }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0" style={{ background: "#ff6b35" }}>
                      {(user.user_metadata?.full_name || user.email || "U")[0].toUpperCase()}
                    </div>
                    <div className="text-left min-w-0">
                      <p style={{ fontSize: "14px", fontWeight: 600, color: "#ffffff" }} className="truncate">{user.user_metadata?.full_name || user.email}</p>
                      <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.48)" }}>Signed in</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.01em", color: "rgba(255,255,255,0.48)" }}>
                      Dietary preferences <span style={{ fontWeight: 400 }}>(optional)</span>
                    </label>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Dietary preferences">
                      {DIETARY_OPTIONS.map((pref) => {
                        const isSelected = dietaryPreferences.includes(pref);
                        return (
                          <button key={pref} type="button" onClick={() => toggleDietaryPref(pref)} className="chip"
                            style={isSelected ? { background: "#ff6b35", color: "#fff", borderColor: "#ff6b35", fontSize: "12px" } : { fontSize: "12px" }}>
                            {pref}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg" style={{ fontSize: "14px", background: locationError ? "rgba(255,69,58,0.08)" : "#272729", border: locationError ? "1px solid rgba(255,69,58,0.2)" : "none" }}>
                    <MapPin className="w-4 h-4 shrink-0" style={{ color: locationError ? "#ff453a" : "#ff6b35" }} />
                    <span style={{ fontWeight: 400, color: locationError ? "#ff453a" : "rgba(255,255,255,0.7)" }}>
                      {location ? "Location ready" : locationError ? locationError : "Needed for restaurant suggestions"}
                    </span>
                  </div>
                  {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("error") && (
                    <div className="flex items-center gap-2 p-3 rounded-lg" style={{ fontSize: "14px", background: "rgba(255,69,58,0.08)", color: "#ff453a" }}>
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

          {/* Scroll hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="flex flex-col items-center gap-2 pt-4"
          >
            <p style={{ fontSize: "12px", fontWeight: 400, letterSpacing: "-0.01em", color: "rgba(255,255,255,0.36)" }}>
              Powered by Gemini &middot; Blinkit &middot; Swiggy &middot; Zomato &middot; Uber &middot; Ola
            </p>
            <ChevronDown className="w-4 h-4 animate-bounce" style={{ color: "rgba(255,255,255,0.2)" }} />
          </motion.div>
        </motion.div>
      </section>

      {/* ── Stats — Light section ── */}
      <section className="section-light" style={{ padding: "64px 24px" }}>
        <div className="max-w-[980px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {STATS.map((s) => (
              <div key={s.label}>
                <p style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 600, lineHeight: 1.07, letterSpacing: "-0.005em", color: "#ff6b35" }}>
                  {s.value}
                </p>
                <p style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "-0.016em", color: "#1d1d1f", marginTop: "4px" }}>
                  {s.label}
                </p>
                <p style={{ fontSize: "12px", fontWeight: 400, letterSpacing: "-0.01em", color: "rgba(0,0,0,0.48)", marginTop: "2px" }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── See it in action — Dark section ── */}
      <section className="section-dark" style={{ padding: "80px 24px" }}>
        <div className="max-w-[980px] mx-auto">
          <div className="text-center" style={{ marginBottom: "48px" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.01em", color: "#ff6b35", marginBottom: "8px" }}>
              See it in action
            </p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 600, lineHeight: 1.10, color: "#ffffff" }}>
              One message. Everything you need.
            </h2>
            <p style={{ fontSize: "17px", fontWeight: 400, lineHeight: 1.47, letterSpacing: "-0.022em", color: "rgba(255,255,255,0.7)", maxWidth: "540px", margin: "16px auto 0" }}>
              Just type what you&apos;re craving. The AI handles the rest &mdash; recipes, ingredients, restaurants, and rides.
            </p>
          </div>

          {/* Demo chat */}
          <div className="max-w-[640px] mx-auto space-y-4">
            {DEMO_MESSAGES.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.15 }}
              >
                {msg.role === "user" && (
                  <div className="flex justify-end">
                    <div style={{
                      background: "#ff6b35", color: "#ffffff", borderRadius: "18px 18px 4px 18px",
                      padding: "12px 16px", fontSize: "15px", lineHeight: 1.47, letterSpacing: "-0.022em",
                      maxWidth: "85%",
                    }}>
                      {msg.text}
                    </div>
                  </div>
                )}
                {msg.role === "ai" && (
                  <div className="flex justify-start">
                    <div className="flex gap-3 max-w-[85%]">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1" style={{ background: "rgba(255,107,53,0.12)" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 8V4H8"/><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>
                        </svg>
                      </div>
                      <div style={{
                        background: "#272729", color: "rgba(255,255,255,0.9)", borderRadius: "4px 18px 18px 18px",
                        padding: "12px 16px", fontSize: "15px", lineHeight: 1.47, letterSpacing: "-0.022em",
                      }}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                )}
                {msg.role === "recipe" && (
                  <div className="flex justify-start">
                    <div className="ml-9 w-full max-w-[85%]" style={{
                      background: "#272729", borderRadius: "12px", padding: "16px", border: "1px solid rgba(255,255,255,0.08)",
                    }}>
                      <div className="flex items-center gap-2" style={{ marginBottom: "8px" }}>
                        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ff6b35" }} />
                        <span style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.01em", color: "#ff6b35" }}>Recipe</span>
                      </div>
                      <p style={{ fontSize: "17px", fontWeight: 600, color: "#ffffff", letterSpacing: "-0.022em" }}>{msg.name}</p>
                      <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.48)", marginTop: "4px" }}>{msg.meta}</p>
                      <div className="flex gap-2 mt-3">
                        {msg.tags?.map((tag) => (
                          <span key={tag} style={{ fontSize: "11px", fontWeight: 400, padding: "3px 8px", borderRadius: "980px", background: "rgba(52,199,89,0.15)", color: "#34c759" }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <span style={{ fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "980px", background: "#f8d800", color: "#000" }}>Buy on Blinkit</span>
                        <span style={{ fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "980px", background: "#fc8019", color: "#fff" }}>Buy on Instamart</span>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* CTA after demo */}
          <div className="text-center" style={{ marginTop: "48px" }}>
            <button
              onClick={() => { setShowAuthCard(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="btn-pill-primary inline-flex items-center gap-2"
              style={{ padding: "14px 32px", fontSize: "17px" }}
            >
              Try it yourself <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Features — Light section ── */}
      <section className="section-light" style={{ padding: "80px 24px" }}>
        <div className="max-w-[980px] mx-auto">
          <div className="text-center" style={{ marginBottom: "56px" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.01em", color: "#ff6b35", marginBottom: "8px" }}>
              Everything in one chat
            </p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 600, lineHeight: 1.10, color: "#1d1d1f" }}>
              From craving to table.
            </h2>
            <p style={{ fontSize: "17px", fontWeight: 400, lineHeight: 1.47, letterSpacing: "-0.022em", color: "rgba(0,0,0,0.56)", maxWidth: "540px", margin: "12px auto 0" }}>
              No more switching between recipe apps, delivery apps, and map apps. One conversation covers everything.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                style={{ background: "#ffffff", borderRadius: "12px", padding: "32px 24px", cursor: "pointer", transition: "box-shadow 0.2s ease" }}
                onClick={() => setExpandedFeature(expandedFeature === i ? null : i)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "rgba(0,0,0,0.08) 0px 4px 20px"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
              >
                <div style={{ color: "#1d1d1f", marginBottom: "16px" }}>{f.icon}</div>
                <h3 style={{ fontSize: "21px", fontWeight: 700, lineHeight: 1.19, letterSpacing: "0.011em", color: "#1d1d1f", marginBottom: "8px" }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: "14px", fontWeight: 400, lineHeight: 1.43, letterSpacing: "-0.016em", color: "rgba(0,0,0,0.56)" }}>
                  {f.desc}
                </p>
                {expandedFeature === i && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    style={{ fontSize: "13px", fontWeight: 400, lineHeight: 1.5, color: "rgba(0,0,0,0.48)", marginTop: "12px", borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: "12px" }}
                  >
                    {f.detail}
                  </motion.p>
                )}
                <p style={{ fontSize: "14px", fontWeight: 400, color: "#0066cc", marginTop: "12px", cursor: "pointer" }}>
                  {expandedFeature === i ? "Less" : "Learn more"} &rsaquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works — Dark section ── */}
      <section id="how-it-works" className="section-dark" style={{ padding: "80px 24px" }}>
        <div className="max-w-[980px] mx-auto">
          <div className="text-center" style={{ marginBottom: "56px" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.01em", color: "#ff6b35", marginBottom: "8px" }}>
              How it works
            </p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 600, lineHeight: 1.10, color: "#ffffff" }}>
              Three steps. That&apos;s it.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step}>
                <div style={{ fontSize: "56px", fontWeight: 600, lineHeight: 1.07, letterSpacing: "-0.005em", color: "rgba(255,107,53,0.2)", marginBottom: "16px" }}>
                  {step.step}
                </div>
                <h3 style={{ fontSize: "21px", fontWeight: 600, lineHeight: 1.19, letterSpacing: "0.011em", color: "#ffffff", marginBottom: "8px" }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: "14px", fontWeight: 400, lineHeight: 1.57, letterSpacing: "-0.016em", color: "rgba(255,255,255,0.7)" }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials — Light section ── */}
      <section className="section-light" style={{ padding: "80px 24px" }}>
        <div className="max-w-[980px] mx-auto">
          <div className="text-center" style={{ marginBottom: "48px" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.01em", color: "#ff6b35", marginBottom: "8px" }}>
              What people are saying
            </p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 600, lineHeight: 1.10, color: "#1d1d1f" }}>
              Loved by home cooks and foodies.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} style={{ background: "#ffffff", borderRadius: "12px", padding: "28px" }}>
                <p style={{ fontSize: "15px", fontWeight: 400, lineHeight: 1.53, letterSpacing: "-0.022em", color: "#1d1d1f" }}>
                  &ldquo;{t.text}&rdquo;
                </p>
                <div style={{ marginTop: "20px", borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: "16px" }}>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "#1d1d1f" }}>{t.name}</p>
                  <p style={{ fontSize: "12px", fontWeight: 400, color: "rgba(0,0,0,0.48)" }}>{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform strip — Dark section ── */}
      <section className="section-dark" style={{ padding: "56px 24px" }}>
        <div className="max-w-[980px] mx-auto text-center space-y-5">
          <p style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.01em", color: "rgba(255,255,255,0.36)" }}>
            Integrated with your favourite platforms
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {PLATFORMS.map((p) => (
              <span
                key={p.name}
                style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  color: p.color,
                  letterSpacing: "-0.02em",
                }}
              >
                {p.name}
              </span>
            ))}
          </div>
          <p style={{ fontSize: "14px", fontWeight: 400, letterSpacing: "-0.016em", color: "rgba(255,255,255,0.48)", maxWidth: "480px", margin: "0 auto" }}>
            We generate deep links directly into each platform &mdash; no API keys or accounts needed on our end. Just tap and go.
          </p>
        </div>
      </section>

      {/* ── FAQ — Light section ── */}
      <section className="section-light" style={{ padding: "80px 24px" }}>
        <div className="max-w-[680px] mx-auto">
          <div className="text-center" style={{ marginBottom: "48px" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.01em", color: "#ff6b35", marginBottom: "8px" }}>
              FAQ
            </p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 600, lineHeight: 1.10, color: "#1d1d1f" }}>
              Common questions.
            </h2>
          </div>
          <div className="space-y-0">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                style={{ borderTop: i === 0 ? "1px solid rgba(0,0,0,0.1)" : "none", borderBottom: "1px solid rgba(0,0,0,0.1)" }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between text-left"
                  style={{ padding: "20px 0", fontSize: "17px", fontWeight: 600, letterSpacing: "-0.022em", color: "#1d1d1f", background: "none", border: "none", cursor: "pointer" }}
                >
                  <span style={{ paddingRight: "16px" }}>{faq.q}</span>
                  {openFaq === i ? (
                    <Minus className="w-4 h-4 shrink-0" style={{ color: "rgba(0,0,0,0.36)" }} />
                  ) : (
                    <Plus className="w-4 h-4 shrink-0" style={{ color: "rgba(0,0,0,0.36)" }} />
                  )}
                </button>
                {openFaq === i && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    style={{ paddingBottom: "20px" }}
                  >
                    <p style={{ fontSize: "14px", fontWeight: 400, lineHeight: 1.57, letterSpacing: "-0.016em", color: "rgba(0,0,0,0.56)" }}>
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA — Dark section ── */}
      <section className="section-dark text-center" style={{ padding: "100px 24px" }}>
        <div className="max-w-[580px] mx-auto space-y-6">
          <h2 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 600, lineHeight: 1.07, letterSpacing: "-0.005em", color: "#ffffff" }}>
            Your next great meal
            <br />
            <span style={{ color: "#ff6b35" }}>starts here.</span>
          </h2>
          <p style={{ fontSize: "17px", fontWeight: 400, lineHeight: 1.47, letterSpacing: "-0.022em", color: "rgba(255,255,255,0.7)" }}>
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
              <div key={item} className="flex items-center gap-1.5" style={{ fontSize: "12px", color: "rgba(255,255,255,0.48)" }}>
                <Check className="w-3 h-3" style={{ color: "#ff6b35" }} />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="section-light text-center" style={{ padding: "32px 24px" }}>
        <p style={{ fontSize: "12px", fontWeight: 400, letterSpacing: "-0.01em", color: "rgba(0,0,0,0.36)" }}>
          &copy; {new Date().getFullYear()} Crave &amp; Create &middot; Your personal AI food companion
        </p>
      </footer>
    </main>
  );
}
