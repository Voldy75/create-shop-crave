"use client";

import { Suspense, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useChat } from "ai/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import { RotateCcw, AlertCircle, ArrowUp, ArrowDown, ChefHat, MapPin, Leaf, Users, Timer, Store, ShoppingCart, Utensils, Package, Sparkles, X, MapPinned, ShoppingBag } from "lucide-react";
import { Chip } from "@/components/cc/chip";
import { LottiePlayer } from "@/components/LottiePlayer";
import { RecipeView } from "@/components/RecipeView";
import { RestaurantView } from "@/components/RestaurantView";
import { SwiggyExpiryBanner } from "@/components/SwiggyExpiryBanner";
import { ApiKeyDialog } from "@/components/ApiKeyDialog";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { BoBowl } from "@/components/mascots";
import { motion, AnimatePresence } from "framer-motion";
import { PROVIDERS, type Provider } from "@/lib/providers";
import { getStoredBYOK, saveBYOK } from "@/lib/byok";
import { parseNumeric } from "@/lib/nutrition";
import { ConversationRail } from "@/components/web/ConversationRail";
import {
  listConversations,
  saveConversation,
  deleteConversation,
  type Conversation,
} from "@/lib/conversation-history";
import { setActiveRecipe, setBuyList, setActiveRestaurants } from "@/lib/mobile-handoff";
import { recipeSlug } from "@/lib/recipe-slug";
import { DAILY_LIMIT } from "@/lib/constants";
import type { RecipeData, RestaurantSuggestion } from "@/lib/types";

/**
 * Bo — chat workspace, built to the Flow "Bo workspace" artboard (w3a).
 *
 * The old page carried its own sticky header with the brand mark, an avatar
 * dropdown (Saved / Planner / Arena / Settings / theme / sign out) and a
 * usage badge — all of it now redundant with components/web/AppShell.tsx's
 * sidebar, which already has that nav. This is the page Phase 10c's topbar
 * work was held back for: the artboard's 74px topbar REPLACES this header
 * rather than stacking on top of it.
 *
 * NOT fully redundant, though — flagged rather than fixed silently. Sign out
 * still works (AppShell's Settings nav item routes to /settings, whose
 * AccountSection has the real signOut() call), but it takes one more click
 * than the old dropdown did. Theme toggle has no home in the logged-in app at
 * all right now — components/ThemeToggle.tsx only appears on the pre-auth
 * landing nav (app/(web)/page.tsx), not in AppShell or /settings. AppShell's
 * `.side-acct` block is a static avatar/name/email display, not a clickable
 * menu trigger. Giving it one is out of scope for this pass.
 *
 * MODEL PICKER — real, but not a live in-place switch. The artboard's `.seg`
 * shows Gemini/GPT-4o/Claude/Grok as if clicking one instantly switches
 * models. That is not how this product works: the free tier always runs
 * server-side Gemini (lib/providers.ts's getServerModel), and using GPT-4o or
 * Claude requires BYOK — pasting your own key in ApiKeyDialog. So the segment
 * control here does two honest things instead: it shows which model is
 * ACTUALLY active (Gemini by default, or your BYOK provider), and clicking a
 * different one opens the real BYOK dialog rather than pretending to switch.
 * Grok is not rendered — it is not a supported provider anywhere in this
 * codebase (see lib/providers.ts's PROVIDERS), the same category of gap as
 * "Continue with Apple" on the sign-in screen.
 *
 * INPUT BAR — the artboard's camera and mic icons are not built. Neither
 * photo attachment nor voice input exists anywhere in /api/chat or this page;
 * rendering the icons would be exactly the kind of dead control this project
 * has consistently avoided (see the mobile buy screen's dropped "Barcode"
 * mode, or Apple sign-in above).
 *
 * RAIL — "From this chat" tracks the most recent recipe/restaurant the
 * assistant has actually returned, computed live from `messages`, not a
 * static mock. The artboard's second rail card is a priced "Missing 1 item"
 * agent-cart row implying live pantry-detection and live Instamart pricing;
 * nothing on web computes either (that is a mobile-only /m/buy capability),
 * so it is not fabricated here — the card instead offers a real Instamart
 * deeplink for the recipe's full ingredient list. The Pro upsell price
 * (₹749) matches UpgradeDialog's real Razorpay amount, not the artboard's
 * stale ₹399.
 */

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
  { label: "Book a DineOut table for 2 tonight", icon: Users },
  { label: "What's in my Instamart cart right now?", icon: ShoppingCart },
  { label: "Track my last food order", icon: Package },
  { label: "Re-order my usual groceries", icon: RotateCcw },
];

/**
 * The three stores /cart can hand off to. Brand colours are DESIGN.md-allowlisted
 * (partner brands are not themeable tokens), and match the same three
 * lib/deeplinks builders /cart itself uses.
 */
const STORE_HANDOFFS = [
  { id: "instamart", label: "Instamart", tint: "#FC8019", ink: "#fff" }, // hex-ok: Swiggy brand
  { id: "blinkit", label: "Blinkit", tint: "#F8CB46", ink: "#3A2E00" }, // hex-ok: Blinkit brand
  { id: "instacart", label: "Instacart", tint: "#0AAD0A", ink: "#fff" }, // hex-ok: Instacart brand
] as const;

/** Compact labels for the model segment control — "Google Gemini" is too wide at 4-up. */
const MODEL_LABELS: Record<Provider, string> = { gemini: "Gemini", openai: "GPT-4o", anthropic: "Claude" };

function timeAwareGreeting(name?: string | null): string {
  const h = new Date().getHours();
  const base =
    h >= 5 && h < 11 ? "Breakfast thoughts" :
    h >= 11 && h < 16 ? "What's for lunch" :
    h >= 16 && h < 21 ? "Dinner plans" :
    "Late-night craving";
  return name ? `${base}, ${name.split(" ")[0]}?` : `${base}?`;
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

interface ParsedChatData {
  type?: "recipe" | "restaurant" | "both";
  recipe?: RecipeData;
  restaurantSuggestion?: RestaurantSuggestion;
}

function ChatPageInner() {
  const { user, userName, location, dietaryPreferences, favoriteCuisines, hydrated } = useUser();
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
  const [showScrollDown, setShowScrollDown] = useState(false);
  const chatAreaRef = useRef<HTMLElement>(null);

  /* ── Conversation history (w8a) + the retractable rail (item 2) ──
     The rail is CLOSED by default and opens only on a quick action. It used to
     open itself whenever a reply happened to contain a recipe, which meant the
     336px column appeared and vanished as you talked. `railFocus` records WHICH
     quick action opened it so the rail can lead with that context. */
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [threadId, setThreadId] = useState<string>(() => `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const [railOpen, setRailOpen] = useState(false);
  const [railFocus, setRailFocus] = useState<"cook" | "buy" | "dine" | null>(null);

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
        userContext: { userName, location, dietaryPreferences, favoriteCuisines },
        ...(activeBYOK ? { provider: activeBYOK.provider, apiKey: activeBYOK.apiKey } : {}),
      };
    },
    [byok, userName, location, dietaryPreferences, favoriteCuisines]
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

  // localStorage read after mount — cannot run during SSR. Same scoped disable
  // and same reason as /cart's hydration effect.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setConversations(listConversations());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  /* Persist ON SETTLE, never mid-stream: saving each token would rewrite the
     whole thread on every frame, and `id` is stable for the life of a thread so
     saveConversation updates in place rather than stacking rows. */
  useEffect(() => {
    if (isLoading || messages.length === 0) return;
    const saved = saveConversation({
      id: threadId,
      messages: messages.map((m) => ({ id: m.id, role: m.role, content: m.content })),
      agentMode,
    });
    /* eslint-disable react-hooks/set-state-in-effect */
    if (saved) setConversations(listConversations());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isLoading, messages, threadId, agentMode]);

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

  const handleSuggestionClick = (s: string) => setInput(s);

  /* ── Conversation rail handlers ── */
  const openThread = (c: Conversation) => {
    setThreadId(c.id);
    setMessages(c.messages.map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content })));
    setError(null);
    // A restored thread's artifacts belong to that thread, so the rail resets
    // rather than keeping the previous conversation's recipe on screen.
    setRailOpen(false);
    setRailFocus(null);
  };

  const removeThread = (id: string) => {
    deleteConversation(id);
    setConversations(listConversations());
    // Deleting the thread you are reading should clear the pane too, or the
    // messages stay visible with nothing backing them.
    if (id === threadId) startNewThread();
  };

  const startNewThread = () => {
    setMessages([]);
    setError(null);
    setThreadId(`c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    setRailOpen(false);
    setRailFocus(null);
  };

  /** A quick action under a Bo answer — this is what opens the rail (item 2). */
  const openRail = (focus: "cook" | "buy" | "dine") => {
    setRailFocus(focus);
    setRailOpen(true);
  };

  const handleChatScroll = () => {
    const el = chatAreaRef.current;
    if (!el) return;
    setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 300);
  };

  const parseContent = (content: string, isStreaming = false): { data: ParsedChatData | null; text: string; isIncomplete: boolean } => {
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

  // The rail's "From this chat" card — the most recent recipe/restaurant the
  // assistant has actually returned, scanned live from the message list.
  const latestData = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "user") continue;
      const { data } = parseContent(m.content);
      if (data?.recipe || data?.restaurantSuggestion) return { messageId: m.id, ...data };
    }
    return null;
  }, [messages]);

  const jumpToMessage = (id: string) => {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const activeModel: Provider = byok?.provider ?? "gemini";
  const statusCaption = isPro
    ? "● online · meshi+"
    : byok
      ? `● online · ${MODEL_LABELS[byok.provider]} (your key)`
      : `● online · ${Math.max(0, DAILY_LIMIT - usageCount)} free chat${DAILY_LIMIT - usageCount === 1 ? "" : "s"} left today`;

  return (
    <div
      className={`flex h-full flex-col md:flex-row${railOpen ? " chat-has-rail" : ""}`}
      style={{ background: "var(--m-cream)" }}
    >
      {/* ── Conversation history (w8a). Hides below 1280px — it competes for the
          same horizontal budget as the sidebar and the right rail. ── */}
      <ConversationRail
        conversations={conversations}
        activeId={messages.length > 0 ? threadId : null}
        onOpen={openThread}
        onDelete={removeThread}
        onNew={startNewThread}
      />

      {/* h-full, not h-screen: this now nests inside AppShell's .main, which
          already gets real viewport height from .web-shell
          (min-height:100dvh) and the sidebar's own height:100dvh. h-screen
          here sized against the true viewport a second time, inside an
          already-constrained flex slot, producing overflow instead of a
          fixed chat column. */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* ── Topbar — built to w3a. Replaces the old sticky header; brand and
            account are now the sidebar's job. ── */}
        <div className="topbar" style={{ gap: 12, flexWrap: "wrap", minHeight: 74, height: "auto" }}>
          <BoBowl width={34} height={34} style={{ flex: "none" }} />
          <div className="vstack" style={{ gap: 0, minWidth: 0 }}>
            <span className="t-h2">Bo</span>
            <span className="t-cap" style={{ color: "var(--m-forest)" }}>{statusCaption}</span>
          </div>

          <div className="grow" />

          {agentMode && (
            <span className="chip-tag chip" style={{ background: "var(--m-tint-peach)", color: "var(--m-burnt)" }}>
              Swiggy agent
            </span>
          )}

          {messages.length > 0 && (
            <button
              onClick={startNewThread}
              className="icon-btn"
              aria-label="Start a new chat"
              title="New chat"
            >
              <RotateCcw width={16} height={16} />
            </button>
          )}

          <div className="seg" role="group" aria-label="Model">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                className={activeModel === p.id ? "seg-on" : ""}
                onClick={() => { if (p.id !== activeModel) setShowApiKeyDialog(true); }}
                title={p.id === activeModel ? `Active: ${p.label}` : `Switch to ${p.label} — needs your own API key`}
              >
                {MODEL_LABELS[p.id]}
              </button>
            ))}
          </div>

          <button onClick={() => router.push("/arena")} className="wlink" style={{ color: "var(--m-plum)", background: "none", border: "none" }}>
            <Sparkles width={16} height={16} />
            Arena
          </button>
        </div>

        {/* ── Chat area ── */}
        <main
          ref={chatAreaRef}
          onScroll={handleChatScroll}
          className="flex-1 overflow-y-auto px-4 md:px-8 space-y-6 pb-40"
          style={{ paddingTop: 24 }}
          aria-live="polite"
          aria-label="Chat messages"
        >
          {agentMode && (
            <div className="mx-auto w-full max-w-3xl">
              <SwiggyExpiryBanner />
            </div>
          )}

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[55vh] text-center space-y-7 px-2">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-3"
              >
                <BoBowl width={56} height={56} style={{ margin: "0 auto" }} />
                <h2 className="t-d1">{timeAwareGreeting(userName)}</h2>
                <p className="t-body-soft" style={{ maxWidth: 380, margin: "0 auto" }}>
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
                  <Chip key={label} onClick={() => handleSuggestionClick(label)} className="inline-flex items-center gap-1.5" style={{ fontSize: 13 }}>
                    <Icon width={14} height={14} style={{ color: "var(--m-forest)" }} />
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
                  id={`msg-${m.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="w-full space-y-3"
                  style={{ scrollMarginTop: 90 }}
                >
                  {(text || (isIncomplete && isStreamingMessage)) && (
                    <div className={`mx-auto w-full max-w-3xl flex ${isUser ? "justify-end" : "justify-start"}`}>
                      <div className={`flex gap-3 ${isUser ? "flex-row-reverse max-w-[92%] md:max-w-[78%]" : "w-full"}`}>
                        {!isUser && (
                          <span
                            style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--m-tint-green)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}
                          >
                            <BoBowl width={28} height={28} />
                          </span>
                        )}
                        <div className={isUser ? "" : "flex-1 min-w-0"} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {text && (
                            isUser ? (
                              <div style={{ background: "var(--m-forest)", color: "var(--m-on-deep)", borderRadius: "20px 20px 6px 20px", padding: "13px 17px" }}>
                                <p className="t-body" style={{ color: "inherit", whiteSpace: "pre-wrap" }}>{text}</p>
                              </div>
                            ) : (
                              <div className="card" style={{ padding: "13px 17px", borderBottomLeftRadius: 6 }}>
                                <p className="t-body" style={{ whiteSpace: "pre-wrap" }}>{text}</p>
                              </div>
                            )
                          )}
                          {isIncomplete && isStreamingMessage && (
                            <div className="flex items-center gap-2">
                              <LottiePlayer src="/lottie/cooking.lottie" width={52} height={52} />
                              <span className="t-cap">Preparing suggestions…</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {data && (
                    <div className="mx-auto w-full max-w-5xl space-y-5">
                      {(data.type === "recipe" || data.type === "both") && data.recipe && <RecipeView data={data.recipe} />}
                      {data.type === "both" && (
                        <div className="flex items-center justify-center py-1">
                          <span className="t-cap">or</span>
                        </div>
                      )}
                      {(data.type === "restaurant" || data.type === "both") && data.restaurantSuggestion && (
                        <RestaurantView data={data.restaurantSuggestion} />
                      )}
                    </div>
                  )}

                  {/* ── Quick actions (item 2). These are what OPEN the rail —
                      it no longer opens itself when a reply happens to contain a
                      recipe. Only rendered on the newest answer, and only for
                      capabilities this reply actually has. ── */}
                  {!isUser && !isLoading && index === messages.length - 1 && data && (
                    <div className="mx-auto w-full max-w-3xl">
                      <div className="hstack ml-9" style={{ gap: 7, flexWrap: "wrap" }}>
                        {data.recipe && (
                          <>
                            <button className="chip pill-sm" onClick={() => openRail("cook")}>
                              <ChefHat width={14} height={14} aria-hidden /> Start cooking
                            </button>
                            <button className="chip pill-sm" onClick={() => openRail("buy")}>
                              <ShoppingBag width={14} height={14} aria-hidden /> Buy ingredients
                            </button>
                          </>
                        )}
                        {data.restaurantSuggestion && (
                          <button className="chip pill-sm" onClick={() => openRail("dine")}>
                            <MapPinned width={14} height={14} aria-hidden /> Dine out
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {!isUser && !isLoading && index === messages.length - 1 && (
                    <div className="mx-auto w-full max-w-3xl">
                      <button onClick={() => reload()} className="ml-9 flex items-center gap-1.5 t-cap" style={{ background: "none", border: "none" }} aria-label="Regenerate last response">
                        <RotateCcw width={12} height={12} />
                        Regenerate
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {isLoading && (
            <div className="mx-auto w-full max-w-3xl flex justify-start gap-3">
              <BoBowl width={40} height={40} style={{ flex: "none", animation: "mm-bob 2.4s ease-in-out infinite" }} />
              <div className="card tint-green" style={{ boxShadow: "none", padding: "16px 18px", borderBottomLeftRadius: 6, display: "flex", gap: 6 }}>
                {[0, 0.16, 0.32].map((d) => (
                  <span key={d} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--m-ink-soft)", animation: `mm-dot 1s ${d}s ease-in-out infinite` }} />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mx-auto w-full max-w-3xl flex justify-start pl-9">
              <div className="hstack" style={{ gap: 8, padding: "12px 16px", background: "color-mix(in srgb, var(--m-red) 12%, transparent)", color: "var(--m-red)", borderRadius: 12 }} role="alert">
                <AlertCircle width={16} height={16} style={{ flex: "none" }} />
                <span className="t-cap" style={{ color: "inherit" }}>{error}</span>
                <button onClick={() => setError(null)} className="t-cap" style={{ background: "none", border: "none", textDecoration: "underline", color: "inherit" }}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </main>

        {/* ── Input — built to w3a's pill, minus the camera/mic icons (no
            attach or voice capability exists to back them).

            `right-0` does not know about the 336px rail — without
            `.chat-input-bar`'s override (globals.css, unlayered so it beats
            this layered Tailwind utility past the same 1100px breakpoint
            `.chat-rail` hides at) this bar's translucent gradient painted
            over the rail's bottom card and visibly clipped its button. ── */}
        <div
          className="chat-input-bar fixed bottom-[57px] md:bottom-0 left-0 md:left-[250px] right-0 px-4 pb-2 md:pb-[calc(env(safe-area-inset-bottom,8px)+20px)] pt-2 flex justify-center pointer-events-none"
          style={{ background: "linear-gradient(to top, var(--m-cream) 60%, transparent)" }}
        >
          <div className="relative w-full max-w-3xl pointer-events-auto">
            {showScrollDown && (
              <button
                onClick={() => scrollRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="icon-btn absolute -top-12 left-1/2 -translate-x-1/2"
                aria-label="Scroll to latest message"
              >
                <ArrowDown width={16} height={16} />
              </button>
            )}
            <form onSubmit={handleChatSubmit} className="input" style={{ height: 58, padding: "0 6px 0 20px" }}>
              <input
                value={input}
                onChange={handleInputChange}
                placeholder={agentMode ? "Order groceries, food, or book a table…" : "Message Bo — recipes, groceries, plans…"}
                className="grow"
                style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", minWidth: 0 }}
                disabled={isLoading}
                aria-label="Type your message"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="pill-primary"
                style={{ width: 44, height: 44, padding: 0, borderRadius: "50%", opacity: isLoading || !input.trim() ? 0.5 : 1, flex: "none" }}
                aria-label="Send message"
              >
                <ArrowUp width={18} height={18} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ── Rail — "From this chat" (w3a), now RETRACTABLE (item 2).
          Closed by default; a quick action under a Bo answer opens it. The hide
          rule and the input bar's 336px inset both live in globals.css and MUST
          stay unlayered — .rail sets its own `display: flex` in the unlayered
          meshi-web.css, so a layered Tailwind `hidden` would lose at every
          width (the trap the sidebar breakpoint hit once already). ── */}
      {railOpen && (
        <aside className="rail chat-rail">
          <div className="hstack" style={{ gap: 8 }}>
            <span className="t-micro grow">From this chat</span>
            <button
              className="icon-btn"
              style={{ width: 30, height: 30 }}
              onClick={() => { setRailOpen(false); setRailFocus(null); }}
              aria-label="Collapse this panel"
              title="Collapse"
            >
              <X width={14} height={14} />
            </button>
          </div>

          {/* railFocus decides which card leads. A "Dine out" click should not
              have to scroll past the recipe card to reach the map button. */}
          {latestData?.recipe && railFocus !== "dine" && (
            <>
              <RecipeSummaryCard recipe={latestData.recipe} onJump={() => jumpToMessage(latestData.messageId)} />

              {/* ITEM 3 — "Start cooking" goes to the recipe's own page. The
                  recipe is handed over through sessionStorage first, so the
                  cooking view resolves it even though it was never saved. */}
              <button
                className="pill-primary"
                style={{ width: "100%" }}
                onClick={() => {
                  setActiveRecipe(latestData.recipe!);
                  router.push(`/recipes/${recipeSlug(latestData.recipe!.name)}/cook`);
                }}
              >
                <ChefHat width={16} height={16} aria-hidden /> Start cooking
              </button>

              {latestData.recipe.ingredients.length > 0 && (
                <div className="card vstack" style={{ padding: 16, gap: 10 }}>
                  <span className="t-h2">Buy ingredients</span>
                  {/* ITEM 3 — these go to /cart (w4a), NOT straight to a store.
                      /cart runs the pantry pre-check first, so the user drops what
                      they already own before anything is ordered. Linking a store
                      directly would skip that and send the whole list. */}
                  <span className="t-cap">
                    Sends the list to your groceries page first, so you can drop what
                    you already have.
                  </span>
                  <div className="vstack" style={{ gap: 7 }}>
                    {STORE_HANDOFFS.map((store) => (
                      <button
                        key={store.id}
                        className="xstore"
                        style={{ width: "100%", background: store.tint, color: store.ink }}
                        onClick={() => {
                          setActiveRecipe(latestData.recipe!);
                          setBuyList({ recipeName: latestData.recipe!.name, items: latestData.recipe!.ingredients });
                          router.push(`/cart?store=${store.id}`);
                        }}
                      >
                        <ShoppingBag width={15} height={15} aria-hidden /> Send to {store.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* The rail never had a restaurant branch — latestData could match a
              restaurantSuggestion and only the recipe path rendered, so the panel
              came up empty on a dine-out answer. */}
          {latestData?.restaurantSuggestion && (
            <div className="card vstack" style={{ padding: 16, gap: 10 }}>
              <span className="t-h2">
                {latestData.restaurantSuggestion.restaurants?.length ?? 0} place
                {(latestData.restaurantSuggestion.restaurants?.length ?? 0) === 1 ? "" : "s"} matched
              </span>
              {latestData.restaurantSuggestion.dishName && (
                <span className="t-cap">for {latestData.restaurantSuggestion.dishName}</span>
              )}
              <button
                className="pill-primary"
                style={{ width: "100%" }}
                onClick={() => {
                  setActiveRestaurants(latestData.restaurantSuggestion!);
                  router.push("/dine-out");
                }}
              >
                <MapPinned width={16} height={16} aria-hidden /> Open the map
              </button>
              <button className="chip" style={{ width: "100%" }} onClick={() => jumpToMessage(latestData.messageId)}>
                Jump to results
              </button>
            </div>
          )}

          {latestData?.recipe && railFocus === "dine" && (
            <RecipeSummaryCard recipe={latestData.recipe} onJump={() => jumpToMessage(latestData.messageId)} />
          )}

          {!latestData?.recipe && !latestData?.restaurantSuggestion && (
            <div className="card" style={{ padding: 16 }}>
              <span className="t-cap">Ask Bo for a recipe or a place to eat and it&rsquo;ll show up here.</span>
            </div>
          )}

          <div className="grow" />

          {!isPro && (
            <div className="card tint-lav vstack" style={{ boxShadow: "none", padding: 16, gap: 10 }}>
              <div className="hstack" style={{ gap: 10 }}>
                <Sparkles width={20} height={20} style={{ color: "var(--m-plum)" }} />
                <span className="t-h2" style={{ color: "var(--m-plum)" }}>Loving Bo?</span>
              </div>
              <span className="t-cap">Go Pro for unlimited chats, or bring your own key.</span>
              <button onClick={() => setShowUpgradeDialog(true)} className="pill-plum" style={{ width: "100%" }}>
                Go Pro — ₹749
              </button>
            </div>
          )}
        </aside>
      )}

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

function RecipeSummaryCard({ recipe, onJump }: { recipe: RecipeData; onJump: () => void }) {
  const kcal = recipe.nutritionEstimate?.calories ? Math.round(parseNumeric(recipe.nutritionEstimate.calories)) : null;
  const protein = recipe.nutritionEstimate?.protein;
  const mins = recipe.prepTime?.match(/\d+/)?.[0];

  return (
    <div className="card" style={{ padding: 16 }}>
      <span className="t-h2" style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {recipe.name}
      </span>
      <div className="hstack" style={{ gap: 16, margin: "14px 0" }}>
        {kcal !== null && (
          <div className="vstack" style={{ gap: 0, alignItems: "center" }}>
            <span className="t-d2" style={{ color: "var(--m-forest)" }}>{kcal}</span>
            <span className="t-cap">kcal</span>
          </div>
        )}
        {protein && (
          <div className="vstack" style={{ gap: 0, alignItems: "center" }}>
            <span className="t-d2">{protein}</span>
            <span className="t-cap">protein</span>
          </div>
        )}
        {mins && (
          <div className="vstack" style={{ gap: 0, alignItems: "center" }}>
            <span className="t-d2">{mins}</span>
            <span className="t-cap">min</span>
          </div>
        )}
      </div>
      <button onClick={onJump} className="pill-primary" style={{ width: "100%" }}>
        Jump to recipe
      </button>
    </div>
  );
}
