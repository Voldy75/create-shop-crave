"use client";

import { useState, useEffect, useRef } from "react";
import { useChat } from "ai/react";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import { Send, Bot, Sparkles, RotateCcw, ArrowLeft, Lock } from "lucide-react";
import { LottiePlayer } from "@/components/LottiePlayer";
import { RecipeView } from "@/components/RecipeView";
import { RestaurantView } from "@/components/RestaurantView";
import { motion, AnimatePresence } from "framer-motion";
import { PROVIDERS, type Provider } from "@/lib/providers";

const BYOK_PROVIDER_KEY = "crave_byok_provider";
const BYOK_API_KEY = "crave_byok_key";

function getStoredBYOK(): { provider: Provider; apiKey: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const provider = localStorage.getItem(BYOK_PROVIDER_KEY) as Provider | null;
    const apiKey = localStorage.getItem(BYOK_API_KEY);
    if (provider && apiKey) return { provider, apiKey };
  } catch { /* ignore */ }
  return null;
}

function parseContent(content: string, isStreaming = false) {
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
  const hasIncompleteJson = content.includes("```json") && !content.includes("\n```", content.indexOf("```json") + 7);
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
}

function ThinkingDots() {
  return (
    <div className="flex gap-1 p-4">
      <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--m-forest)" }} />
      <div className="w-2 h-2 rounded-full animate-bounce delay-75" style={{ background: "var(--m-forest)" }} />
      <div className="w-2 h-2 rounded-full animate-bounce delay-150" style={{ background: "var(--m-forest)" }} />
    </div>
  );
}

interface ModelPanelProps {
  label: string;
  modelName: string;
  accentColor: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
  isLoading: boolean;
}

function ModelPanel({ label, modelName, accentColor, messages, isLoading }: ModelPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full overflow-hidden"
      style={{ background: "var(--m-card)", borderRadius: "12px" }}>
      {/* Panel header */}
      <div className="px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: "1px solid var(--m-ink-faint)", background: "var(--m-cream-2)" }}>
        <Bot className="w-4 h-4" style={{ color: accentColor }} />
        <div>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: accentColor }}>{label}</p>
          <p className="text-xs" style={{ color: "var(--m-ink-soft)" }}>{modelName}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: "var(--m-ink-soft)" }}>
            Response will appear here
          </div>
        )}

        <AnimatePresence>
          {messages.map((m, index) => {
            if (m.role === "user") return null;
            const isStreamingMsg = isLoading && index === messages.length - 1;
            const { data, text, isIncomplete } = parseContent(m.content, isStreamingMsg);

            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                {text && (
                  <div className="p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ background: "var(--m-cream-2)", color: "var(--m-ink)" }}>
                    {text}
                  </div>
                )}
                {isIncomplete && isStreamingMsg && <ThinkingDots />}
                {data && (
                  <div className="mt-2">
                    {data.type === "recipe" && data.recipe && <RecipeView data={data.recipe} />}
                    {data.type === "restaurant" && data.restaurantSuggestion && (
                      <RestaurantView data={data.restaurantSuggestion} />
                    )}
                    {data.type === "both" && (
                      <>
                        {data.recipe && <RecipeView data={data.recipe} />}
                        <div className="text-center py-2 text-xs font-bold uppercase" style={{ color: "var(--m-ink-soft)" }}>OR</div>
                        {data.restaurantSuggestion && <RestaurantView data={data.restaurantSuggestion} />}
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {isLoading && messages.filter((m) => m.role === "assistant").length === 0 && <ThinkingDots />}
        <div ref={scrollRef} />
      </div>
    </div>
  );
}

export default function ArenaPage() {
  const { user, userName, location, dietaryPreferences, hydrated } = useUser();
  const router = useRouter();

  const [isPro, setIsPro] = useState(false);
  const [proChecked, setProChecked] = useState(false);
  const [byok, setByok] = useState<{ provider: Provider; apiKey: string } | null>(null);
  const [rightProvider, setRightProvider] = useState<Provider>("anthropic");
  const [sharedInput, setSharedInput] = useState("");

  useEffect(() => {
    if (hydrated && !user) router.replace("/");
  }, [hydrated, user, router]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/subscribe/status")
      .then((r) => r.json())
      .then((data) => { setIsPro(data.isPro); setProChecked(true); })
      .catch(() => setProChecked(true));
    setByok(getStoredBYOK());
  }, [user]);

  const userContext = { userName, location, dietaryPreferences };

  const leftChat = useChat({
    api: "/api/chat",
    body: { userContext },
    id: "arena-left",
  });

  const rightChat = useChat({
    api: "/api/chat",
    body: {
      userContext,
      ...(byok ? { provider: rightProvider, apiKey: byok.apiKey } : {}),
    },
    id: "arena-right",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sharedInput.trim()) return;
    leftChat.append({ role: "user", content: sharedInput });
    rightChat.append({ role: "user", content: sharedInput });
    setSharedInput("");
  };

  const handleReset = () => {
    leftChat.setMessages([]);
    rightChat.setMessages([]);
  };

  const isLoading = leftChat.isLoading || rightChat.isLoading;

  if (!hydrated || !proChecked) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "var(--m-cream)" }}>
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--m-forest)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!isPro) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8" style={{ background: "var(--m-cream)" }}>
        {/* Pikachu animation — LottieFiles */}
        <LottiePlayer
          src="/lottie/arena.lottie"
          width={200}
          height={200}
        />
        <h1 className="text-2xl font-bold" style={{ color: "var(--m-ink)", letterSpacing: "-0.02em" }}>
          Model Arena is Pro-only
        </h1>
        <p className="text-center max-w-sm" style={{ color: "var(--m-ink-soft)" }}>
          Compare two AI models side by side on the same food prompt. Upgrade to Pro to unlock.
        </p>
        <div className="flex gap-3">
          <button onClick={() => router.push("/chat")} className="btn-pill-secondary">
            <ArrowLeft className="w-4 h-4 inline mr-2" /> Back to Chat
          </button>
          <button onClick={() => router.push("/chat")} className="btn-pill-primary flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Upgrade to Pro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: "var(--m-cream)" }}>
      {/* Header */}
      <header className="glass-nav px-6 flex items-center justify-between sticky top-0 z-10" style={{ height: "48px" }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/chat")}
            className="p-2 rounded-full transition-colors text-[var(--m-ink-soft)] hover:bg-[var(--m-cream-2)]"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg" style={{ background: "var(--m-tint-green)" }}>
              <Sparkles className="w-4 h-4" style={{ color: "var(--m-forest)" }} />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight" style={{ color: "var(--m-ink)", letterSpacing: "-0.02em" }}>
                Model Arena
              </h1>
              <p className="text-xs" style={{ color: "var(--m-ink-soft)" }}>Same prompt, two AI models</p>
            </div>
          </div>
          <span className="text-xs font-bold px-2 py-1 rounded-full"
            style={{ background: "var(--m-tint-green)", color: "var(--m-forest)", border: "1px solid rgba(255,107,53,0.25)" }}>
            Pro
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: "var(--m-ink-soft)" }}>Right model:</span>
            <div className="flex gap-1">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setRightProvider(p.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={
                    rightProvider === p.id
                      ? { background: "var(--m-forest)", color: "#ffffff" }
                      : { background: "var(--m-cream-2)", color: "var(--m-ink-soft)" }
                  }
                >
                  {p.label.replace("Google ", "").replace("Anthropic ", "")}
                </button>
              ))}
            </div>
          </div>

          {(leftChat.messages.length > 0 || rightChat.messages.length > 0) && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors text-[var(--m-ink-soft)] hover:bg-[var(--m-cream-2)] hover:text-[var(--m-ink)]"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>
      </header>

      {/* BYOK notice */}
      {!byok && (
        <div className="px-6 py-2 text-xs text-center"
          style={{ background: "rgba(255,159,28,0.08)", borderBottom: "1px solid rgba(255,159,28,0.15)", color: "#ff9f1c" }}>
          Right panel needs your API key. Go to{" "}
          <button onClick={() => router.push("/chat")} className="underline font-medium">
            Chat
          </button>{" "}
          and add your key first.
        </div>
      )}

      {/* Two-panel area */}
      <main className="flex-1 grid grid-cols-2 gap-4 p-4 overflow-hidden pb-28">
        <ModelPanel
          label="Model A"
          modelName="Gemini 2.5 Flash"
          accentColor="#0a84ff"
          messages={leftChat.messages}
          isLoading={leftChat.isLoading}
        />
        <ModelPanel
          label="Model B"
          modelName={PROVIDERS.find((p) => p.id === rightProvider)?.label ?? rightProvider}
          accentColor="#bf5af2"
          messages={rightChat.messages}
          isLoading={rightChat.isLoading}
        />
      </main>

      {/* Shared input */}
      <div className="fixed bottom-6 left-0 right-0 px-4 flex justify-center pointer-events-none">
        <div className="w-full max-w-3xl pointer-events-auto">
          <form
            onSubmit={handleSubmit}
            className="relative flex items-center rounded-full p-2"
            style={{
              background: "var(--m-card)",
              border: "1px solid var(--m-ink-faint)",
              boxShadow: "var(--m-shadow-lift)",
            }}
          >
            <input
              value={sharedInput}
              onChange={(e) => setSharedInput(e.target.value)}
              placeholder="Ask both models the same food question..."
              className="flex-1 bg-transparent text-base px-6 py-3 outline-none"
              style={{ color: "var(--m-ink)" }}
              disabled={isLoading}
            />
            <button
              type="submit"
              className="rounded-full w-12 h-12 shrink-0 flex items-center justify-center transition-colors disabled:opacity-50"
              style={{ background: "var(--m-forest)", color: "#ffffff" }}
              disabled={isLoading || !sharedInput.trim()}
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
