"use client";

import { useState, useEffect, useRef } from "react";
import { useChat } from "ai/react";
import { useRouter } from "next/navigation";
import { useUser } from "../context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, Sparkles, RotateCcw, ArrowLeft, Lock } from "lucide-react";
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
      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" />
      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75" />
      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150" />
    </div>
  );
}

interface ModelPanelProps {
  label: string;
  modelName: string;
  color: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
  isLoading: boolean;
}

function ModelPanel({ label, modelName, color, messages, isLoading }: ModelPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full border border-gray-100 rounded-2xl overflow-hidden">
      {/* Panel header */}
      <div className={`px-4 py-3 flex items-center gap-2 border-b border-gray-100 ${color}`}>
        <Bot className="w-4 h-4" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wider">{label}</p>
          <p className="text-xs opacity-75">{modelName}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
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
                  <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
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
                        <div className="text-center py-2 text-xs font-bold text-gray-400 uppercase">OR</div>
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

  // Left: always Gemini server model
  const leftChat = useChat({
    api: "/api/chat",
    body: { userContext },
    id: "arena-left",
  });

  // Right: user's chosen provider via BYOK
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
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent<HTMLFormElement>;
    leftChat.setInput(sharedInput);
    rightChat.setInput(sharedInput);
    // Submit both — need to set input first then call append
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
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isPro) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-6 p-8">
        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
          <Lock className="w-8 h-8 text-indigo-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Model Arena is Pro-only</h1>
        <p className="text-gray-500 text-center max-w-sm">
          Compare two AI models side by side on the same food prompt. Upgrade to Pro to unlock.
        </p>
        <div className="flex gap-3">
          <Button onClick={() => router.push("/chat")} variant="outline" className="rounded-full">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Chat
          </Button>
          <Button
            onClick={() => router.push("/chat")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full"
          >
            <Sparkles className="w-4 h-4 mr-2" /> Upgrade to Pro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/chat")}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-gray-900">Model Arena</h1>
              <p className="text-xs text-gray-400">Same prompt, two AI models</p>
            </div>
          </div>
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-indigo-600 text-white">Pro</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Right panel model selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Right model:</span>
            <div className="flex gap-1">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setRightProvider(p.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    rightProvider === p.id
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {p.label.replace("Google ", "").replace("Anthropic ", "")}
                </button>
              ))}
            </div>
          </div>

          {(leftChat.messages.length > 0 || rightChat.messages.length > 0) && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-full hover:bg-gray-100"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>
      </header>

      {/* BYOK notice if no key for right panel */}
      {!byok && (
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-2 text-xs text-amber-700 text-center">
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
          color="bg-blue-50 text-blue-700"
          messages={leftChat.messages}
          isLoading={leftChat.isLoading}
        />
        <ModelPanel
          label="Model B"
          modelName={PROVIDERS.find((p) => p.id === rightProvider)?.label ?? rightProvider}
          color="bg-purple-50 text-purple-700"
          messages={rightChat.messages}
          isLoading={rightChat.isLoading}
        />
      </main>

      {/* Shared input */}
      <div className="fixed bottom-6 left-0 right-0 px-4 flex justify-center pointer-events-none">
        <div className="w-full max-w-3xl pointer-events-auto">
          <form
            onSubmit={handleSubmit}
            className="relative flex items-center shadow-2xl rounded-full bg-white border border-gray-100 p-2"
          >
            <Input
              value={sharedInput}
              onChange={(e) => setSharedInput(e.target.value)}
              placeholder="Ask both models the same food question..."
              className="flex-1 border-0 bg-transparent text-lg px-6 py-4 focus-visible:ring-0 placeholder:text-gray-400"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white w-12 h-12 shrink-0"
              disabled={isLoading || !sharedInput.trim()}
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
