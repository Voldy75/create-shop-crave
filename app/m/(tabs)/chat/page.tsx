"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useChat } from "ai/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Mic, ArrowUp, Star } from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import { setActiveRecipe, setActiveRestaurants } from "@/lib/mobile-handoff";
import type { ChatResponse, RecipeData, RestaurantSuggestion } from "@/lib/types";

/**
 * meshi AI Chat — functional, wired to /api/chat (or /api/agent when ?agent=1).
 * Reproduces the v2-screens ScreenChat: meshi bubbles, inline recipe +
 * restaurant rich cards parsed from the assistant's structured JSON, suggestion
 * chips, pill input with mic + send. Honors ?q= seed + ?agent= mode like the
 * web chat.
 */

const SUGGESTIONS = ["Butter chicken", "Healthy lunch", "Pizza near me", "20-min veg dinner"];

export default function MobileChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatInner />
    </Suspense>
  );
}

function extractResponse(content: string): { text: string; data: ChatResponse | null } {
  // The model returns a friendly message + a ```json {…} ``` block.
  const fence = content.match(/```json\s*([\s\S]*?)```/i);
  if (!fence) return { text: content.trim(), data: null };
  let data: ChatResponse | null = null;
  try {
    data = JSON.parse(fence[1]) as ChatResponse;
  } catch {
    data = null;
  }
  const text = content.replace(fence[0], "").trim();
  return { text, data };
}

function ChatInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { userName, location, dietaryPreferences } = useUser();

  const agentMode = useMemo(() => params?.get("agent") === "1", []); // eslint-disable-line react-hooks/exhaustive-deps
  const seed = useMemo(() => params?.get("q") ?? "", []); // eslint-disable-line react-hooks/exhaustive-deps

  const { messages, input, handleInputChange, handleSubmit, append, isLoading } = useChat({
    api: agentMode ? "/api/agent" : "/api/chat",
    body: { userContext: { userName, location, dietaryPreferences } },
  });

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || !seed) return;
    fired.current = true;
    window.history.replaceState({}, "", agentMode ? "/m/chat?agent=1" : "/m/chat");
    append({ role: "user", content: seed });
  }, [seed, agentMode, append]);

  const onOpenRecipe = (r: RecipeData) => { setActiveRecipe(r); router.push("/m/recipe"); };
  const onBuyRecipe = (r: RecipeData) => { setActiveRecipe(r); router.push("/m/buy"); };
  const onOpenRestaurants = (s: RestaurantSuggestion) => { setActiveRestaurants(s); router.push("/m/restaurants"); };

  const empty = messages.length === 0;

  return (
    <div className="col" style={{ height: "100dvh", background: "var(--cc-bg)" }}>
      {/* Header */}
      <div className="glass row" style={{ padding: "calc(env(safe-area-inset-top,12px) + 6px) 14px 8px", justifyContent: "space-between", borderBottom: "1px solid var(--cc-line)", position: "sticky", top: 0, zIndex: 5 }}>
        <span style={{ width: 36 }} />
        <span className="row" style={{ gap: 6, fontWeight: 600 }}>
          <span className="ai-orb" /> meshi AI{agentMode ? " · order" : ""}
        </span>
        <button onClick={() => router.push("/m/chat")} style={{ width: 36, height: 36, borderRadius: "50%", background: "none", border: "none", color: "var(--cc-ink-2)", display: "grid", placeItems: "center" }} aria-label="New chat">
          <Plus width={22} height={22} />
        </button>
      </div>

      {/* Messages */}
      <div className="scroll" style={{ flex: 1, padding: "16px 14px 12px" }}>
        {empty && (
          <div className="col" style={{ alignItems: "center", textAlign: "center", gap: 14, paddingTop: "18vh" }}>
            <span className="ai-orb" style={{ width: 40, height: 40 }} />
            <h1 className="t-h1">What are you craving?</h1>
            <p className="t-small" style={{ maxWidth: 260 }}>A recipe with shopping links, the best nearby spots, or have meshi order it.</p>
            <div className="row hscroll" style={{ gap: 8, marginTop: 8, maxWidth: "100%" }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => append({ role: "user", content: s })}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          if (m.role === "user") {
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
                <div style={{ maxWidth: "82%", background: "var(--cc-acc)", color: "#fff", borderRadius: "18px 18px 4px 18px", padding: "10px 14px", fontSize: 14, lineHeight: 1.45 }}>{m.content}</div>
              </div>
            );
          }
          const { text, data } = extractResponse(m.content);
          return (
            <div key={m.id} className="row" style={{ gap: 8, alignItems: "flex-start", marginBottom: 14 }}>
              <span className="ai-orb" style={{ marginTop: 2 }} />
              <div className="col" style={{ flex: 1, gap: 10, minWidth: 0 }}>
                {text && (
                  <div style={{ background: "var(--cc-surf-2)", borderRadius: "4px 18px 18px 18px", padding: "11px 14px", fontSize: 14, lineHeight: 1.45 }}>{text}</div>
                )}
                {data?.recipe && <RecipeCard recipe={data.recipe} onOpen={onOpenRecipe} onBuy={onBuyRecipe} />}
                {data?.restaurantSuggestion?.restaurants?.length ? <RestaurantsCard sugg={data.restaurantSuggestion} onMap={onOpenRestaurants} /> : null}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="row" style={{ gap: 8, marginBottom: 14 }}>
            <span className="ai-orb" style={{ marginTop: 2 }} />
            <div style={{ background: "var(--cc-surf-2)", borderRadius: "4px 18px 18px 18px", padding: "11px 14px", fontSize: 14, color: "var(--cc-ink-3)" }}>thinking…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{ padding: "10px 14px calc(10px + env(safe-area-inset-bottom,0px))", borderTop: "1px solid var(--cc-line)" }}>
        <div className="row" style={{ background: "var(--cc-surf-2)", borderRadius: "var(--cc-r-pill)", padding: "6px 6px 6px 16px", gap: 6, border: "1px solid var(--cc-line)" }}>
          <input
            value={input}
            onChange={handleInputChange}
            placeholder={agentMode ? "Order groceries, food, or book a table…" : "Tell me what you're craving…"}
            style={{ flex: 1, background: "none", border: "none", padding: 0, fontSize: 14 }}
          />
          <button type="button" style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "var(--cc-surf-3)", color: "var(--cc-ink-1)", display: "grid", placeItems: "center" }} aria-label="Voice (coming soon)">
            <Mic width={18} height={18} />
          </button>
          <button type="submit" disabled={!input.trim()} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: input.trim() ? "var(--cc-acc)" : "var(--cc-surf-3)", color: "#fff", display: "grid", placeItems: "center" }} aria-label="Send">
            <ArrowUp width={18} height={18} />
          </button>
        </div>
      </form>
    </div>
  );
}

function RecipeCard({ recipe, onOpen, onBuy }: { recipe: RecipeData; onOpen: (r: RecipeData) => void; onBuy: (r: RecipeData) => void }) {
  const nutr = recipe.nutritionEstimate;
  const meta = [recipe.prepTime, recipe.servings ? `${recipe.servings} servings` : null, nutr?.calories].filter(Boolean).join(" · ");
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="ph ph-saffron" style={{ height: 130, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.6))" }} />
        <div style={{ position: "absolute", left: 12, top: 12 }}>
          <span className="chip" style={{ background: "rgba(0,0,0,0.55)", color: "#fff", borderColor: "transparent", fontSize: 10 }}>RECIPE</span>
        </div>
        <div style={{ position: "absolute", left: 14, right: 14, bottom: 12, color: "#fff" }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.015em" }}>{recipe.name}</div>
          {meta && <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>{meta}</div>}
        </div>
      </div>
      <div style={{ padding: 12, display: "flex", gap: 6 }}>
        <button className="pill-tonal" style={{ flex: 1, padding: "9px 12px", fontSize: 13 }} onClick={() => onOpen(recipe)}>View recipe</button>
        <button className="pill-primary" style={{ flex: 1, padding: "9px 12px", fontSize: 13 }} onClick={() => onBuy(recipe)}>Buy ingredients</button>
      </div>
    </div>
  );
}

function RestaurantsCard({ sugg, onMap }: { sugg: RestaurantSuggestion; onMap: (s: RestaurantSuggestion) => void }) {
  const list = (sugg.restaurants ?? []).slice(0, 3);
  return (
    <button onClick={() => onMap(sugg)} className="card" style={{ padding: 12, textAlign: "left", width: "100%" }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <span className="t-cap">{list.length} NEAR YOU</span>
        <span className="t-small" style={{ color: "var(--cc-acc)", fontWeight: 600 }}>Map ›</span>
      </div>
      {list.map((r, i) => (
        <div key={r.name} className="row" style={{ gap: 10, padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid var(--cc-line)" }}>
          <div className="ph ph-fire" style={{ width: 40, height: 40, borderRadius: "var(--cc-r-md)", flexShrink: 0 }} />
          <div className="col" style={{ flex: 1, gap: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
            <span className="t-small">{[r.area, r.priceRange].filter(Boolean).join(" · ")}</span>
          </div>
          <div className="row" style={{ gap: 3, color: "var(--cc-acc)" }}>
            <Star width={12} height={12} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--cc-ink-1)" }}>{r.rating}</span>
          </div>
        </div>
      ))}
    </button>
  );
}
