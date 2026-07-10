"use client";

import { Suspense, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useChat } from "ai/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "../context/UserContext";
import { Bot, Sparkles, RotateCcw, AlertCircle, Heart, Calendar, LogOut, Swords, ArrowUp, ArrowDown, Settings, ChefHat, MapPin, Leaf, Users, Timer, Store, ShoppingCart, Utensils, Package } from "lucide-react";
import { Chip } from "@/components/cc/chip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LottiePlayer } from "@/components/LottiePlayer";
import { RecipeView } from "@/components/RecipeView";
import { RestaurantView } from "@/components/RestaurantView";
import { UsageBadge } from "@/components/UsageBadge";
import { SwiggyExpiryBanner } from "@/components/SwiggyExpiryBanner";
import { ApiKeyDialog } from "@/components/ApiKeyDialog";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { motion, AnimatePresence } from "framer-motion";
import type { Provider } from "@/lib/providers";
import { DAILY_LIMIT } from "@/lib/constants";

const BYOK_PROVIDER_KEY = "crave_byok_provider";
const BYOK_API_KEY = "crave_byok_key";

function getStoredBYOK(): { provider: Provider; apiKey: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const provider = localStorage.getItem(BYOK_PROVIDER_KEY) as Provider | null;
    const apiKey = localStorage.getItem(BYOK_API_KEY);
    if (provider && apiKey) return { provider, apiKey };
  } catch {
    /* ignore */
  }
  return null;
}

function saveBYOK(provider: Provider, apiKey: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BYOK_PROVIDER_KEY, provider);
  localStorage.setItem(BYOK_API_KEY, apiKey);
}

const SUGGESTION_PROMPTS = [
  { label: "Butter chicken recipe", icon: ChefHat },
  { label: "Pizza near me", icon: MapPin },
  { label: "Healthy lunch ideas", icon: Leaf },
  { label: "Veg dinner for 2", icon: Users },
  { label: "Quick 20-min meal", icon: Timer },
  { label: "Restaurants open now", icon: Store },
];

const AGENT_SUGGESTION_PROMPTS = [
  { label: "Order milk, eggs, and bread on Instamart", icon: ShoppingCart },
  { label: "Order biryani from a top-rated place", icon: Utensils },
  { label: "Book a DineOut table for 2 tonight", icon: Calendar },
  { label: "What's in my Instamart cart right now?", icon: ShoppingCart },
  { label: "Track my last food order", icon: Package },
  { label: "Re-order my usual groceries", icon: RotateCcw },
];

function timeAwareGreeting(name?: string | null): string {
  const h = new Date().getHours();
  const base =
    h >= 5 && h < 11 ? "Breakfast thoughts" :
    h >= 11 && h < 16 ? "What's for lunch" :
    h >= 16 && h < 21 ? "Dinner plans" :
    "Late-night craving";
  return name ? `${base}, ${name.split(" ")[0]}?` : `${base}?`;
}

function MenuItem({ icon: Icon, label, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-left text-[14px] text-[var(--cc-text-secondary)] hover:bg-[var(--cc-surface-3)] hover:text-[var(--cc-text-primary)]"
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

export default function ChatPage() {
  // Wrapped in Suspense so useSearchParams inside ChatPageInner doesn't trigger
  // a static-rendering bailout warning under Next 16.
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const { user, session, userName, location, dietaryPreferences, hydrated, signOut } = useUser();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [byokError, setByokError] = useState<string | null>(null);
  const [byok, setByok] = useState<{ provider: Provider; apiKey: string } | null>(null);
  const [usageCount, setUsageCount] = useState(0);
  const [isPro, setIsPro] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setByok(getStoredBYOK());
  }, []);

  // Close the avatar menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/subscribe/status")
      .then((r) => r.json())
      .then((data) => { if (data.isPro) setIsPro(true); })
      .catch(() => {});

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("upgraded") === "true") {
        setIsPro(true);
        window.history.replaceState({}, "", "/chat");
      }
    }
  }, [user]);

  useEffect(() => {
    if (hydrated && !user) {
      router.replace("/");
    }
  }, [user, router, hydrated]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/usage")
      .then((r) => r.json())
      .then((data) => { if (data.count !== undefined) setUsageCount(data.count); })
      .catch(() => {});
  }, [user]);

  const buildBody = useCallback(
    (overrideBYOK?: { provider: Provider; apiKey: string } | null) => {
      const activeBYOK = overrideBYOK !== undefined ? overrideBYOK : byok;
      return {
        userContext: { userName, location, dietaryPreferences },
        ...(activeBYOK ? { provider: activeBYOK.provider, apiKey: activeBYOK.apiKey } : {}),
      };
    },
    [byok, userName, location, dietaryPreferences]
  );

  const searchParams = useSearchParams();
  // Capture once at mount — switching modes mid-session requires a new navigation.
  const agentMode = useMemo(() => searchParams?.get("agent") === "1", []); // eslint-disable-line react-hooks/exhaustive-deps
  const initialQuery = useMemo(() => searchParams?.get("q") ?? "", []); // eslint-disable-line react-hooks/exhaustive-deps
  const chatApi = agentMode ? "/api/agent" : "/api/chat";

  const { messages, input, handleInputChange, handleSubmit, setInput, setMessages, isLoading, reload, append } = useChat({
    api: chatApi,
    body: buildBody(),
    onResponse: (response) => {
      if (response.status === 401) { router.replace("/"); return; }
      if (response.status === 429) {
        setShowUpgradeDialog(true);
        return;
      }
      if (response.status === 412) {
        // /api/agent emits 412 when the user's Swiggy token is missing/expired.
        setError("Your Swiggy connection isn't active. Reconnect in Settings → Notifications.");
        return;
      }
      if (!byok) setUsageCount((prev) => Math.min(prev + 1, DAILY_LIMIT));
      setError(null);
    },
    onError: (err) => {
      const msg = err.message || "";
      if (msg.includes("rate_limit") || msg.includes("Daily limit") || msg.includes("429")) {
        setShowUpgradeDialog(true);
      } else if (msg.includes("invalid_key") || msg.includes("invalid key")) {
        setByokError(`Your ${byok?.provider || "API"} key is invalid or has insufficient quota.`);
        setShowApiKeyDialog(true);
      } else {
        setError("Something went wrong. Please try again.");
      }
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // One-shot: when the user lands here via a CTA hand-off like
  // /chat?agent=1&q=Order+ingredients..., prefill the input and auto-fire.
  const autoFiredRef = useRef(false);
  useEffect(() => {
    if (autoFiredRef.current) return;
    if (!hydrated || !user) return;
    if (!initialQuery) return;
    autoFiredRef.current = true;
    // Strip the query params from the URL so a refresh doesn't re-send.
    window.history.replaceState({}, "", "/chat" + (agentMode ? "?agent=1" : ""));
    append({ role: "user", content: initialQuery });
  }, [hydrated, user, initialQuery, agentMode, append]);

  const handleBYOKSave = (provider: Provider, apiKey: string) => {
    saveBYOK(provider, apiKey);
    const newByok = { provider, apiKey };
    setByok(newByok);
    setByokError(null);
    setShowApiKeyDialog(false);
    if (pendingMessage) { setInput(pendingMessage); setPendingMessage(null); }
  };

  const handleChatSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setPendingMessage(input);
    handleSubmit(e);
  };

  const handleSuggestionClick = (s: string) => {
    setInput(s);
  };

  const handleChatScroll = () => {
    const el = chatAreaRef.current;
    if (!el) return;
    setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 300);
  };

  const parseContent = (content: string, isStreaming = false) => {
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    const hasIncompleteJson =
      content.includes("```json") && !content.includes("\n```", content.indexOf("```json") + 7);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        const text = content.replace(/```json\n[\s\S]*?\n```/, "").trim();
        return { data, text, isIncomplete: false };
      } catch {
        return { data: null, text: isStreaming ? "" : content, isIncomplete: true };
      }
    }
    if (hasIncompleteJson && isStreaming) return { data: null, text: "", isIncomplete: true };
    return { data: null, text: content, isIncomplete: false };
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: "var(--cc-bg)" }}
    >
      {/* ── Header — Apple glass nav, 48px ── */}
      <header
        className="glass-nav px-3 md:px-5 flex items-center justify-between sticky top-0 z-10"
        style={{ height: "48px" }}
      >
        {/* Brand */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{ background: "var(--cc-accent)" }}
          >
            <Sparkles className="w-3 h-3 text-white" />
          </div>
          <span className="hidden sm:inline" style={{
            fontSize: "14px",
            fontWeight: 400,
            letterSpacing: "-0.01em",
            color: "var(--cc-text-primary)",
          }}>
            Crave &amp; Create
          </span>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Status badge */}
          {isPro ? (
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: "980px",
                background: "rgba(255,107,53,0.15)",
                color: "var(--cc-accent)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Sparkles className="w-3 h-3" /> Pro
            </span>
          ) : byok ? (
            <span style={{
              fontSize: "12px",
              fontWeight: 400,
              padding: "4px 10px",
              borderRadius: "980px",
              background: "var(--cc-surface-2)",
              color: "var(--cc-text-secondary)",
            }}>
              {byok.provider}
            </span>
          ) : (
            <UsageBadge
              count={usageCount}
              limit={DAILY_LIMIT}
              onClick={() => setShowUpgradeDialog(true)}
            />
          )}

          {agentMode && (
            <span
              title="Chat is in Swiggy agent mode — calls /api/agent with MCP tools"
              style={{
                fontSize: "10px",
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: "980px",
                background: "rgba(252,128,25,0.12)",
                color: "#fc8019",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Swiggy
            </span>
          )}

          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); setError(null); }}
              className="flex items-center gap-1 transition-opacity hover:opacity-100"
              style={{
                fontSize: "12px",
                fontWeight: 400,
                color: "var(--cc-text-secondary)",
                padding: "4px 10px",
                borderRadius: "980px",
                opacity: 0.8,
              }}
            >
              <RotateCcw className="w-3 h-3" />
              New
            </button>
          )}

          {/* Avatar menu — click to open, Escape / outside click to close */}
          <div className="relative ml-1" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white font-semibold shrink-0 transition-transform hover:scale-105"
              style={{ background: "var(--cc-accent)", fontSize: "11px" }}
              aria-label={userName ? `Menu — signed in as ${userName}` : "User menu"}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              {userName ? userName[0].toUpperCase() : "U"}
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-9 flex flex-col p-1.5 min-w-[200px] z-30 border border-[var(--cc-border)]"
                style={{
                  background: "var(--cc-surface-2)",
                  borderRadius: "var(--cc-radius-lg)",
                  boxShadow: "var(--cc-shadow-md)",
                }}
              >
                <span
                  className="truncate px-3 pt-2 pb-1"
                  style={{ fontSize: "12px", color: "var(--cc-text-tertiary)" }}
                >
                  {user?.email}
                </span>
                <MenuItem icon={Heart} label="Saved" onClick={() => { setMenuOpen(false); router.push("/favorites"); }} />
                <MenuItem icon={Calendar} label="Planner" onClick={() => { setMenuOpen(false); router.push("/planner"); }} />
                {isPro && (
                  <MenuItem icon={Swords} label="Arena" onClick={() => { setMenuOpen(false); router.push("/arena"); }} />
                )}
                <MenuItem icon={Settings} label="Settings" onClick={() => { setMenuOpen(false); router.push("/settings"); }} />
                <div className="flex items-center justify-between px-3 py-1.5">
                  <span style={{ fontSize: "14px", color: "var(--cc-text-secondary)" }}>Theme</span>
                  <ThemeToggle />
                </div>
                <hr className="my-1" style={{ borderColor: "var(--cc-border)" }} />
                <button
                  role="menuitem"
                  onClick={handleSignOut}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-left text-[14px] text-[var(--cc-text-secondary)] hover:bg-[rgba(255,69,58,0.1)] hover:text-[#ff453a]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Chat area ── */}
      <main
        ref={chatAreaRef}
        onScroll={handleChatScroll}
        className="flex-1 overflow-y-auto px-4 md:px-8 space-y-6 pb-40"
        style={{ paddingTop: "24px" }}
        aria-live="polite"
        aria-label="Chat messages"
      >
        {/* Swiggy expiry / not-connected banner, agent mode only */}
        {agentMode && (
          <div className="mx-auto w-full max-w-3xl">
            <SwiggyExpiryBanner />
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[55vh] text-center space-y-7 px-2">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-3"
            >
              <div
                className="mx-auto w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{ background: "var(--cc-accent-dim)" }}
              >
                <Sparkles className="w-5 h-5" style={{ color: "var(--cc-accent)" }} />
              </div>
              <h2 style={{
                fontFamily: "var(--font-display-stack)",
                fontSize: "clamp(26px, 5vw, 34px)",
                fontWeight: 600,
                lineHeight: 1.1,
                letterSpacing: "-0.015em",
                color: "var(--cc-text-primary)",
              }}>
                {timeAwareGreeting(userName)}
              </h2>
              <p style={{
                fontSize: "16px",
                fontWeight: 400,
                lineHeight: 1.47,
                letterSpacing: "-0.022em",
                color: "var(--cc-text-secondary)",
                maxWidth: "380px",
                margin: "0 auto",
              }}>
                I&apos;ll find you the perfect recipe or restaurant based on your mood.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="flex gap-2 flex-wrap justify-center max-w-[560px]"
            >
              {(agentMode ? AGENT_SUGGESTION_PROMPTS : SUGGESTION_PROMPTS).map(({ label, icon: Icon }) => (
                <Chip
                  key={label}
                  onClick={() => handleSuggestionClick(label)}
                  className="inline-flex items-center gap-1.5"
                  style={{ fontSize: "13px" }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: "var(--cc-accent)" }} />
                  {label}
                </Chip>
              ))}
            </motion.div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((m, index) => {
            const isUser = m.role === "user";
            const isStreamingMessage = !isUser && isLoading && index === messages.length - 1;
            const { data, text, isIncomplete } = !isUser
              ? parseContent(m.content, isStreamingMessage)
              : { data: null, text: m.content, isIncomplete: false };

            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="w-full space-y-3"
              >
                {/* Message text — user gets a bubble, AI reads as plain text in the column */}
                {(text || (isIncomplete && isStreamingMessage)) && (
                  <div className={`mx-auto w-full max-w-3xl flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div className={`flex gap-3 ${isUser ? "flex-row-reverse max-w-[92%] md:max-w-[78%]" : "w-full"}`}>
                      {!isUser && (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1"
                          style={{ background: "var(--cc-accent-dim)" }}
                        >
                          <Bot className="w-3.5 h-3.5" style={{ color: "var(--cc-accent)" }} />
                        </div>
                      )}
                      <div className={`space-y-3 ${isUser ? "" : "flex-1 min-w-0"}`}>
                        {text && (
                          <div
                            style={
                              isUser
                                ? {
                                    background: "var(--cc-accent)",
                                    color: "#ffffff",
                                    borderRadius: "18px 18px 4px 18px",
                                    padding: "12px 16px",
                                    fontSize: "15px",
                                    lineHeight: "1.47",
                                    letterSpacing: "-0.022em",
                                  }
                                : {
                                    color: "var(--cc-text-primary)",
                                    paddingTop: "4px",
                                    fontSize: "15px",
                                    lineHeight: "1.6",
                                    letterSpacing: "-0.011em",
                                  }
                            }
                          >
                            <p className="whitespace-pre-wrap">{text}</p>
                          </div>
                        )}
                        {isIncomplete && isStreamingMessage && (
                          <div className="flex items-center gap-2">
                            <LottiePlayer
                              src="/lottie/cooking.lottie"
                              width={52}
                              height={52}
                            />
                            <span style={{ fontSize: "14px", color: "var(--cc-text-secondary)" }}>
                              Preparing suggestions...
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Data cards — wider column so the map/list layouts breathe */}
                {data && (
                  <div className="mx-auto w-full max-w-5xl space-y-5">
                    {data.type === "recipe" && data.recipe && <RecipeView data={data.recipe} />}
                    {data.type === "restaurant" && data.restaurantSuggestion && (
                      <RestaurantView data={data.restaurantSuggestion} />
                    )}
                    {data.type === "both" && (
                      <>
                        {data.recipe && <RecipeView data={data.recipe} />}
                        <div className="flex items-center justify-center py-1">
                          <span style={{
                            padding: "4px 12px",
                            borderRadius: "980px",
                            fontSize: "12px",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "-0.01em",
                            background: "var(--cc-surface-2)",
                            color: "var(--cc-text-tertiary)",
                          }}>
                            or
                          </span>
                        </div>
                        {data.restaurantSuggestion && <RestaurantView data={data.restaurantSuggestion} />}
                      </>
                    )}
                  </div>
                )}

                {/* Regenerate — under the last completed AI response */}
                {!isUser && !isLoading && index === messages.length - 1 && (
                  <div className="mx-auto w-full max-w-3xl">
                    <button
                      onClick={() => reload()}
                      className="ml-9 flex items-center gap-1.5 transition-colors text-[12px] text-[var(--cc-text-tertiary)] hover:text-[var(--cc-text-primary)]"
                      aria-label="Regenerate last response"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Regenerate
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Typing indicator */}
        {isLoading && (
          <div className="mx-auto w-full max-w-3xl flex justify-start">
            <div className="ml-9">
              <LottiePlayer
                src="/lottie/cooking.lottie"
                width={64}
                height={64}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-auto w-full max-w-3xl flex justify-start ml-0 pl-9">
            <div
              className="flex items-center gap-2 px-4 py-3 text-sm"
              style={{
                background: "rgba(255,69,58,0.08)",
                color: "#ff453a",
                borderRadius: "12px",
              }}
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-2 underline text-xs opacity-70 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </main>

      {/* ── Floating input — Apple pill ── */}
      {/* On mobile, offset by BottomNav height (49px + safe-area) so input sits above it */}
      <div
        className="fixed bottom-[57px] md:bottom-0 left-0 right-0 px-4 pb-2 md:pb-[calc(env(safe-area-inset-bottom,8px)+20px)] pt-2 flex justify-center pointer-events-none"
        style={{ background: "linear-gradient(to top, var(--cc-bg) 60%, transparent)" }}
      >
        <div className="relative w-full max-w-3xl pointer-events-auto">
          {/* Scroll to latest */}
          {showScrollDown && (
            <button
              onClick={() => scrollRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="absolute -top-12 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full flex items-center justify-center border border-[var(--cc-border)] bg-[var(--cc-surface-2)] shadow-[var(--cc-shadow-md)] text-[var(--cc-text-secondary)] transition-colors hover:text-[var(--cc-text-primary)]"
              aria-label="Scroll to latest message"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          )}
          <form
            onSubmit={handleChatSubmit}
            className="relative flex items-center"
            style={{
              background: "var(--cc-surface)",
              borderRadius: "980px",
              padding: "6px 6px 6px 20px",
              boxShadow: "var(--cc-shadow-sm)",
            }}
          >
            <input
              value={input}
              onChange={handleInputChange}
              placeholder={agentMode ? "Order groceries, food, or book a table…" : "Ask anything about food..."}
              className="flex-1 bg-transparent outline-none placeholder-shown:text-ellipsis"
              style={{
                color: "var(--cc-text-primary)",
                fontSize: "17px",
                lineHeight: "1.47",
                letterSpacing: "-0.022em",
              }}
              disabled={isLoading}
              aria-label="Type your message"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-150 disabled:opacity-40 bg-[var(--cc-accent)] enabled:hover:bg-[var(--cc-accent-hover)] enabled:hover:scale-105"
              aria-label="Send message"
            >
              <ArrowUp className="w-4 h-4 text-white" />
            </button>
          </form>
        </div>
      </div>

      {showUpgradeDialog && (
        <UpgradeDialog
          onProActivated={() => {
            setIsPro(true);
            setShowUpgradeDialog(false);
            if (pendingMessage) { setInput(pendingMessage); setPendingMessage(null); }
          }}
          onBYOKSave={(provider, apiKey) => { handleBYOKSave(provider, apiKey); setShowUpgradeDialog(false); }}
          onClose={() => setShowUpgradeDialog(false)}
        />
      )}

      {showApiKeyDialog && (
        <ApiKeyDialog
          onSave={handleBYOKSave}
          onClose={() => { setShowApiKeyDialog(false); setByokError(null); }}
          error={byokError}
        />
      )}
    </div>
  );
}
