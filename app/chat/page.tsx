"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useChat } from "ai/react";
import { useRouter } from "next/navigation";
import { useUser } from "../context/UserContext";
import { Send, Bot, Sparkles, RotateCcw, AlertCircle, Heart, Calendar, LogOut, Swords, ArrowUp } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LottiePlayer } from "@/components/LottiePlayer";
import { RecipeView } from "@/components/RecipeView";
import { RestaurantView } from "@/components/RestaurantView";
import { UsageBadge } from "@/components/UsageBadge";
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
  "Butter chicken recipe",
  "Pizza near me",
  "Healthy lunch ideas",
  "Veg dinner for 2",
  "Quick 20-min meal",
  "Restaurants open now",
];

export default function ChatPage() {
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

  useEffect(() => {
    setByok(getStoredBYOK());
  }, []);

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

  const { messages, input, handleInputChange, handleSubmit, setInput, setMessages, isLoading, reload } = useChat({
    api: "/api/chat",
    body: buildBody(),
    onResponse: (response) => {
      if (response.status === 401) { router.replace("/"); return; }
      if (response.status === 429) {
        setShowUpgradeDialog(true);
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
            style={{ background: "#ff6b35" }}
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
                color: "#ff6b35",
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

          {isPro && (
            <button
              onClick={() => router.push("/arena")}
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
              <Swords className="w-3 h-3" />
              Arena
            </button>
          )}

          {/* Saved + Plan — hidden on mobile since BottomNav has them */}
          <button
            onClick={() => router.push("/favorites")}
            className="hidden md:flex items-center gap-1 transition-opacity hover:opacity-100"
            style={{
              fontSize: "12px",
              fontWeight: 400,
              color: "var(--cc-text-secondary)",
              padding: "4px 10px",
              borderRadius: "980px",
              opacity: 0.8,
            }}
          >
            <Heart className="w-3 h-3" />
            Saved
          </button>

          <button
            onClick={() => router.push("/planner")}
            className="hidden md:flex items-center gap-1 transition-opacity hover:opacity-100"
            style={{
              fontSize: "12px",
              fontWeight: 400,
              color: "var(--cc-text-secondary)",
              padding: "4px 10px",
              borderRadius: "980px",
              opacity: 0.8,
            }}
          >
            <Calendar className="w-3 h-3" />
            Plan
          </button>

          <ThemeToggle />

          {/* Avatar */}
          <div className="relative group ml-1">
            <button
              className="w-6 h-6 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
              style={{ background: "#ff6b35", fontSize: "11px" }}
              aria-label={userName ? `Signed in as ${userName}` : "User menu"}
            >
              {userName ? userName[0].toUpperCase() : "U"}
            </button>
            <div
              className="absolute right-0 top-8 hidden group-hover:flex flex-col p-2 min-w-[160px] z-20"
              style={{
                background: "var(--cc-surface-2)",
                borderRadius: "12px",
                boxShadow: "var(--cc-shadow-md)",
              }}
            >
              <span style={{ fontSize: "12px", padding: "4px 12px", color: "var(--cc-text-secondary)" }} className="truncate max-w-[150px]">
                {user?.email}
              </span>
              <hr style={{ borderColor: "var(--cc-border)", margin: "4px 0" }} />
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                style={{ fontSize: "14px", color: "var(--cc-text-secondary)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,69,58,0.1)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#ff453a";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--cc-text-secondary)";
                }}
              >
                <LogOut className="w-3 h-3" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Chat area ── */}
      <main
        className="flex-1 overflow-y-auto px-4 md:px-8 space-y-6 pb-40"
        style={{ paddingTop: "24px" }}
        aria-live="polite"
        aria-label="Chat messages"
      >
        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[55vh] text-center space-y-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <LottiePlayer
                src="https://lottie.host/8483639a-af26-4834-96a4-65b1037ba3f7/xxffw9TMQQ.lottie"
                width={260}
                height={260}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="space-y-2"
            >
              <h2 style={{
                fontSize: "28px",
                fontWeight: 600,
                lineHeight: 1.14,
                letterSpacing: "0.007em",
                color: "var(--cc-text-primary)",
              }}>
                What are you craving?
              </h2>
              <p style={{
                fontSize: "17px",
                fontWeight: 400,
                lineHeight: 1.47,
                letterSpacing: "-0.022em",
                color: "var(--cc-text-secondary)",
                maxWidth: "360px",
                margin: "0 auto",
              }}>
                I&apos;ll find you the perfect recipe or restaurant based on your mood.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="flex gap-2 flex-wrap justify-center"
            >
              {SUGGESTION_PROMPTS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestionClick(s)}
                  className="chip"
                  style={{ fontSize: "14px" }}
                >
                  {s}
                </button>
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
                {/* Text bubble */}
                {(text || (isIncomplete && isStreamingMessage)) && (
                  <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div className={`flex gap-3 max-w-[92%] md:max-w-[78%] ${isUser ? "flex-row-reverse" : ""}`}>
                      {!isUser && (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1"
                          style={{ background: "rgba(255,107,53,0.12)" }}
                        >
                          <Bot className="w-3.5 h-3.5" style={{ color: "#ff6b35" }} />
                        </div>
                      )}
                      <div className="space-y-3">
                        {text && (
                          <div
                            style={
                              isUser
                                ? {
                                    background: "#ff6b35",
                                    color: "#ffffff",
                                    borderRadius: "18px 18px 4px 18px",
                                    padding: "12px 16px",
                                    fontSize: "15px",
                                    lineHeight: "1.47",
                                    letterSpacing: "-0.022em",
                                  }
                                : {
                                    background: "var(--cc-surface)",
                                    color: "var(--cc-text-primary)",
                                    borderRadius: "4px 18px 18px 18px",
                                    padding: "12px 16px",
                                    fontSize: "15px",
                                    lineHeight: "1.47",
                                    letterSpacing: "-0.022em",
                                  }
                            }
                          >
                            <p className="whitespace-pre-wrap">{text}</p>
                          </div>
                        )}
                        {isIncomplete && isStreamingMessage && (
                          <div className="flex items-center gap-2">
                            <LottiePlayer
                              src="https://lottie.host/e2a8398b-9344-4093-81f0-794006e677b2/VOvEFRmVnf.lottie"
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

                {/* Data cards — full width */}
                {data && (
                  <div className="space-y-5">
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
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start ml-9">
            <LottiePlayer
              src="https://lottie.host/e2a8398b-9344-4093-81f0-794006e677b2/VOvEFRmVnf.lottie"
              width={64}
              height={64}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex justify-start ml-9">
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
        <div className="w-full max-w-3xl pointer-events-auto">
          <form
            onSubmit={handleChatSubmit}
            className="relative flex items-center"
            style={{
              background: "var(--cc-surface)",
              borderRadius: "980px",
              padding: "6px 6px 6px 20px",
              boxShadow: "rgba(0,0,0,0.22) 3px 5px 30px 0px",
            }}
          >
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Ask anything about food..."
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
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-150 disabled:opacity-40"
              style={{ background: "#ff6b35" }}
              onMouseEnter={(e) => {
                if (!isLoading && input.trim()) {
                  (e.currentTarget as HTMLButtonElement).style.background = "#ff5520";
                  (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.05)";
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#ff6b35";
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
              }}
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
