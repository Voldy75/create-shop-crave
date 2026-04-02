"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useChat } from "ai/react";
import { useRouter } from "next/navigation";
import { useUser } from "../context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, Sparkles, RotateCcw, AlertCircle, Heart, Calendar, LogOut } from "lucide-react";
import { RecipeView } from "@/components/RecipeView";
import { RestaurantView } from "@/components/RestaurantView";
import { UsageBadge } from "@/components/UsageBadge";
import { ApiKeyDialog } from "@/components/ApiKeyDialog";
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

export default function ChatPage() {
  const { user, session, userName, location, dietaryPreferences, hydrated, signOut } = useUser();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [byokError, setByokError] = useState<string | null>(null);
  const [byok, setByok] = useState<{ provider: Provider; apiKey: string } | null>(null);
  const [usageCount, setUsageCount] = useState(0);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  // Hydrate BYOK from localStorage
  useEffect(() => {
    setByok(getStoredBYOK());
  }, []);

  // Redirect to home if not signed in (wait for hydration first)
  useEffect(() => {
    if (hydrated && !user) {
      router.replace("/");
    }
  }, [user, router, hydrated]);

  // Fetch current usage count on mount
  useEffect(() => {
    if (!user) return;
    fetch("/api/usage")
      .then((r) => r.json())
      .then((data) => {
        if (data.count !== undefined) setUsageCount(data.count);
      })
      .catch(() => {/* non-critical */});
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
      if (response.status === 401) {
        router.replace("/");
        return;
      }
      if (response.status === 429) {
        response.json().then((data) => {
          if (data.needsKey) {
            setShowApiKeyDialog(true);
          }
        });
        return;
      }
      // On success with free tier, increment local count
      if (!byok) {
        setUsageCount((prev) => Math.min(prev + 1, DAILY_LIMIT));
      }
      setError(null);
    },
    onError: (err) => {
      const msg = err.message || "";
      if (msg.includes("invalid_key") || msg.includes("invalid key")) {
        setByokError(`Your ${byok?.provider || "API"} key is invalid or has insufficient quota.`);
        setShowApiKeyDialog(true);
      } else {
        setError("Something went wrong. Please try again.");
      }
    },
  });

  // Auto-scroll
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

    // Re-submit the message that was blocked if any
    if (pendingMessage) {
      setInput(pendingMessage);
      setPendingMessage(null);
    }
  };

  const handleChatSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // Save pending message in case we hit rate limit
    setPendingMessage(input);
    handleSubmit(e);
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
    if (hasIncompleteJson && isStreaming) {
      return { data: null, text: "", isIncomplete: true };
    }
    return { data: null, text: content, isIncomplete: false };
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
            <Sparkles className="w-4 h-4" />
          </div>
          <h1 className="font-bold text-lg tracking-tight text-gray-900">Crave & Create</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Usage badge — shows free usage; hidden when BYOK active */}
          {!byok && (
            <UsageBadge count={usageCount} limit={DAILY_LIMIT} />
          )}
          {byok && (
            <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600">
              Using {byok.provider}
            </span>
          )}

          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); setError(null); }}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-full hover:bg-gray-100"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New Chat
            </button>
          )}
          <button
            onClick={() => router.push("/favorites")}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-red-500 transition-colors px-3 py-1.5 rounded-full hover:bg-gray-100"
          >
            <Heart className="w-3.5 h-3.5" />
            Favorites
          </button>
          <button
            onClick={() => router.push("/planner")}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-indigo-600 transition-colors px-3 py-1.5 rounded-full hover:bg-gray-100"
          >
            <Calendar className="w-3.5 h-3.5" />
            Planner
          </button>

          {/* Avatar + sign out */}
          <div className="relative group">
            <button
              className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium text-sm"
              aria-label={userName ? `Signed in as ${userName}` : "User menu"}
            >
              {userName ? userName[0].toUpperCase() : "U"}
            </button>
            <div className="absolute right-0 top-10 hidden group-hover:flex flex-col bg-white border border-gray-100 rounded-xl shadow-lg p-2 min-w-[160px] z-20">
              <span className="text-xs text-gray-500 px-3 py-1 truncate max-w-[150px]">
                {user?.email}
              </span>
              <hr className="my-1 border-gray-100" />
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg px-3 py-2 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 pb-44">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-2">
              <Bot className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">What are you craving?</h2>
            <p className="text-gray-500 max-w-md text-lg">
              I can help you find the perfect restaurant or guide you through a delicious recipe.
            </p>
            <div className="flex gap-2 flex-wrap justify-center">
              {["Italian dinner", "Spicy tacos", "Healthy salad", "Sushi nearby"].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-full text-sm font-medium text-gray-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div className={`flex gap-4 max-w-[90%] md:max-w-[80%] ${isUser ? "flex-row-reverse" : ""}`}>
                  {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 mt-1">
                      <Bot className="w-5 h-5" />
                    </div>
                  )}
                  <div className="space-y-4 w-full">
                    {text && (
                      <div
                        className={`p-5 rounded-2xl leading-relaxed text-[15px] ${
                          isUser
                            ? "bg-gray-900 text-white rounded-tr-sm"
                            : "bg-gray-50 text-gray-900 rounded-tl-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{text}</p>
                      </div>
                    )}
                    {isIncomplete && isStreamingMessage && (
                      <div className="p-5 rounded-2xl bg-gray-50 text-gray-900 rounded-tl-sm">
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75" />
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150" />
                          </div>
                          <span className="text-gray-500 text-sm">Preparing your personalized suggestions...</span>
                        </div>
                      </div>
                    )}
                    {data && (
                      <div className="space-y-6 mt-2">
                        {data.type === "recipe" && data.recipe && <RecipeView data={data.recipe} />}
                        {data.type === "restaurant" && data.restaurantSuggestion && (
                          <RestaurantView data={data.restaurantSuggestion} />
                        )}
                        {data.type === "both" && (
                          <>
                            {data.recipe && <RecipeView data={data.recipe} />}
                            <div className="flex items-center justify-center">
                              <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-500 uppercase tracking-wider">
                                OR
                              </span>
                            </div>
                            {data.restaurantSuggestion && <RestaurantView data={data.restaurantSuggestion} />}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {isLoading && (
          <div className="flex justify-start ml-12">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-75" />
              <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-150" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-start ml-12">
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-2xl text-sm" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-2 underline text-xs">
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </main>

      {/* Floating Input */}
      <div className="fixed bottom-6 left-0 right-0 px-4 flex justify-center pointer-events-none">
        <div className="w-full max-w-3xl pointer-events-auto">
          <form
            onSubmit={handleChatSubmit}
            className="relative flex items-center shadow-2xl rounded-full bg-white border border-gray-100 p-2"
          >
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Ask anything about food..."
              className="flex-1 border-0 bg-transparent text-lg px-6 py-4 focus-visible:ring-0 placeholder:text-gray-400"
              disabled={isLoading}
              aria-label="Type your message"
            />
            <Button
              type="submit"
              size="icon"
              className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white w-12 h-12 shrink-0 transition-transform hover:scale-105"
              disabled={isLoading || !input.trim()}
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </div>

      {/* BYOK Dialog */}
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
