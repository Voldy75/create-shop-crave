"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "ai/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Camera, ArrowUp } from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import { getStoredBYOK } from "@/lib/byok";
import { setActiveRecipe, setActiveRestaurants } from "@/lib/mobile-handoff";
import { foodImage } from "@/lib/food-images";
import { BoBowl } from "@/components/mascots";
import { CarrotRating } from "@/components/mobile/CarrotRating";
import type { ChatResponse, RecipeData, RestaurantSuggestion } from "@/lib/types";

/**
 * Chat with Bo — built to the Flow 3 "Chat with Bo (AI)" artboard (1e).
 *
 * Bo is the counterparty, not a UI chrome element: he sits in the header with a
 * live status line, tucks against the bottom-left of every one of his bubbles,
 * and bobs over a three-dot bubble while thinking. The old screen used an empty
 * `.ai-orb` ring for all three, which read as a loading spinner rather than a
 * character.
 *
 * The inline recipe card is the artboard's `.duo` treatment — a photo with a
 * burnt-orange duotone wash and the title laid over it — replacing the previous
 * white card with a separate image block.
 *
 * Wiring to /api/chat (or /api/agent when ?agent=1), the ?q= seed, and the
 * recipe/restaurant handoff are all unchanged.
 */

const SUGGESTIONS = ["Butter chicken", "Healthy lunch", "Pizza near me", "20-min veg dinner"];

/** Bo's header status. Idle copy comes from the artboard. */
const STATUS_IDLE = "Ready when you are";
const STATUS_BUSY = "Stirring ideas…";

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
  const { userName, location, dietaryPreferences, favoriteCuisines } = useUser();

  const agentMode = useMemo(() => params?.get("agent") === "1", []); // eslint-disable-line react-hooks/exhaustive-deps
  const seed = useMemo(() => params?.get("q") ?? "", []); // eslint-disable-line react-hooks/exhaustive-deps

  // A key entered here — or on web — lifts the free daily cap. Read once at
  // mount from the shared BYOK slots; when present it rides along in the body
  // and `/api/chat` uses it instead of the server key.
  const [byok, setByok] = useState<{ provider: string; apiKey: string } | null>(null);
  useEffect(() => { setByok(getStoredBYOK()); }, []);

  // Free users hitting the daily cap get a 429 ("Add your API key to continue").
  // Web opens a dialog; mobile is route-based, so send them to the 7f key
  // screen with a marker so it can bounce them back to chat once a key is set.
  // Without this the request failed silently and nothing happened on screen.
  const onCapReached = () => router.push("/m/settings/key?from=chat");

  const { messages, input, handleInputChange, handleSubmit, append, isLoading } = useChat({
    api: agentMode ? "/api/agent" : "/api/chat",
    body: {
      userContext: { userName, location, dietaryPreferences, favoriteCuisines },
      ...(byok ? { provider: byok.provider, apiKey: byok.apiKey } : {}),
    },
    onResponse: (res) => {
      // Only the free cap (429) routes to key entry. A BYOK key that is invalid
      // comes back 400 and is left to the generic failure path rather than
      // sending the user in a loop to a screen where their key already sits.
      if (res.status === 429) onCapReached();
    },
    onError: (err) => {
      const msg = err.message || "";
      if (msg.includes("Daily limit") || msg.includes("rate_limit") || msg.includes("429")) onCapReached();
    },
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
    /* The artboard pins the conversation between the header and the tab bar
       (`inset:52px 0 86px`). Fixed positioning reproduces that and keeps the
       composer off the keyboard, so only the message list scrolls. */
    <div
      style={{
        position: "fixed",
        top: 0,
        bottom: "calc(86px + env(safe-area-inset-bottom, 0px))",
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 520,
        display: "flex",
        flexDirection: "column",
        background: "var(--m-cream)",
      }}
    >
      {/* Header — Bo, his status, and a fresh-conversation control */}
      <div
        className="hstack"
        style={{
          padding: "calc(env(safe-area-inset-top, 12px) + 8px) 20px 10px",
          borderBottom: "1.5px solid var(--m-ink-faint)",
          flex: "none",
        }}
      >
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "var(--m-tint-green)",
            display: "grid",
            placeItems: "center",
            flex: "none",
          }}
        >
          <BoBowl width={32} height={32} />
        </span>
        <span className="vstack grow" style={{ gap: 0 }}>
          <span className="t-h2">Bo{agentMode ? " · order" : ""}</span>
          <span className="t-cap" style={{ color: "var(--m-forest)" }}>
            {isLoading ? STATUS_BUSY : STATUS_IDLE}
          </span>
        </span>
        <button
          onClick={() => router.push("/m/chat")}
          className="icon-btn"
          aria-label="New chat"
        >
          <Plus width={20} height={20} />
        </button>
      </div>

      {/* Conversation */}
      <div className="scroll" style={{ flex: 1, padding: "16px 20px 12px" }}>
        {empty && (
          <div className="vstack" style={{ alignItems: "center", textAlign: "center", gap: 14, paddingTop: "14vh" }}>
            <BoBowl width={72} height={72} style={{ animation: "mm-bob 2.4s ease-in-out infinite" }} />
            <h1 className="t-d2">What are you craving?</h1>
            <p className="t-body-soft" style={{ maxWidth: 270 }}>
              A recipe with shopping links, the best nearby spots, or have Bo order it.
            </p>
            <div className="hstack" style={{ gap: 8, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
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
                <div
                  className="t-body"
                  style={{
                    maxWidth: "82%",
                    background: "var(--m-forest)",
                    color: "var(--m-on-deep)",
                    borderRadius: "20px 20px 6px 20px",
                    padding: "12px 16px",
                  }}
                >
                  {m.content}
                </div>
              </div>
            );
          }
          const { text, data } = extractResponse(m.content);
          return (
            /* Bo tucks against the bottom-left of his own bubble stack. */
            <div key={m.id} className="hstack" style={{ gap: 8, alignItems: "flex-end", marginBottom: 14 }}>
              <BoBowl width={30} height={30} style={{ flex: "none" }} />
              <div className="vstack" style={{ flex: 1, gap: 10, minWidth: 0, alignItems: "flex-start" }}>
                {/* The artboard keeps Bo's line and his recipe suggestion in ONE
                    bubble, so the card reads as a single utterance. Only split
                    them when there is no recipe to carry. */}
                {data?.recipe ? (
                  <RecipeCard recipe={data.recipe} text={text} onOpen={onOpenRecipe} onBuy={onBuyRecipe} />
                ) : text ? (
                  <div className="card t-body" style={{ padding: "12px 16px", borderBottomLeftRadius: 6 }}>{text}</div>
                ) : null}
                {data?.restaurantSuggestion?.restaurants?.length ? <RestaurantsCard sugg={data.restaurantSuggestion} onMap={onOpenRestaurants} /> : null}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="hstack" style={{ gap: 8, alignItems: "flex-end", marginBottom: 14 }}>
            <BoBowl width={36} height={36} style={{ flex: "none", animation: "mm-bob 2.4s ease-in-out infinite" }} />
            <div
              className="card tint-green hstack"
              style={{ boxShadow: "none", padding: "12px 16px", borderBottomLeftRadius: 6, gap: 6 }}
              role="status"
              aria-label="Bo is thinking"
            >
              {[0, 0.15, 0.3].map((d) => (
                <span
                  key={d}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "var(--m-forest)",
                    animation: `mm-dot-soft .9s ${d}s ease-in-out infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form onSubmit={handleSubmit} style={{ padding: "0 20px 14px", flex: "none" }}>
        <div className="input">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder={agentMode ? "Order groceries, food, or book a table…" : "Ask Bo anything edible…"}
            style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, font: "inherit", color: "inherit" }}
          />
          <button
            type="button"
            style={{ background: "none", border: "none", padding: 0, color: "var(--m-ink-soft)", display: "grid", placeItems: "center" }}
            aria-label="Log a meal with the camera"
            onClick={() => router.push("/m/plan")}
          >
            <Camera width={19} height={19} />
          </button>
          <button
            type="submit"
            disabled={!input.trim()}
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              border: "none",
              background: input.trim() ? "var(--m-forest)" : "var(--m-cream-2)",
              color: input.trim() ? "var(--m-on-deep)" : "var(--m-ink-soft)",
              display: "grid",
              placeItems: "center",
              marginRight: -8,
              flex: "none",
            }}
            aria-label="Send"
          >
            <ArrowUp width={18} height={18} />
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Inline recipe suggestion — the artboard's duotone photo card. The image is
 * keyless (lib/food-images); with no match the `.ph` gradient shows through the
 * same duotone wash, so the card never renders as an empty box.
 */
function RecipeCard({ recipe, text, onOpen, onBuy }: { recipe: RecipeData; text?: string; onOpen: (r: RecipeData) => void; onBuy: (r: RecipeData) => void }) {
  const img = foodImage(recipe.name);
  const nutr = recipe.nutritionEstimate;
  const meta = [recipe.prepTime, recipe.servings ? `${recipe.servings} servings` : null, nutr?.calories]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="card" style={{ padding: "12px 14px", width: "100%", borderBottomLeftRadius: 6 }}>
      {text && <span className="t-body" style={{ display: "block", marginBottom: 10 }}>{text}</span>}
      <div
        className={`duo duo-orange ${img ? "" : "ph ph-saffron"}`}
        style={{
          height: 120,
          borderRadius: 14,
          backgroundImage: img ? `url(${img})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="duo-body vstack" style={{ justifyContent: "flex-end", padding: 10, gap: 2 }}>
          <span style={{ font: "800 16px/1.05 var(--m-font-display)", color: "var(--m-on-deep)" }}>{recipe.name}</span>
          {meta && <span className="t-cap on-photo-soft">{meta}</span>}
        </div>
      </div>
      <div className="hstack" style={{ marginTop: 10, gap: 8 }}>
        <button className="pill-primary pill-sm grow" onClick={() => onOpen(recipe)}>Cook it</button>
        <button className="pill-secondary pill-sm" onClick={() => onBuy(recipe)}>Buy</button>
      </div>
    </div>
  );
}

/**
 * Inline restaurant suggestion. No artboard covers this in-chat, so it borrows
 * the design's `.row` list-row card and carrot ratings from the Restaurants
 * screen rather than inventing a treatment.
 */
function RestaurantsCard({ sugg, onMap }: { sugg: RestaurantSuggestion; onMap: (s: RestaurantSuggestion) => void }) {
  const list = (sugg.restaurants ?? []).slice(0, 3);
  return (
    <div className="card vstack" style={{ padding: "12px 14px", width: "100%", gap: 8 }}>
      <div className="hstack" style={{ justifyContent: "space-between" }}>
        <span className="t-micro">{list.length} near you</span>
        <button
          onClick={() => onMap(sugg)}
          className="t-cap"
          style={{ background: "none", border: "none", padding: 0, color: "var(--m-forest)", fontWeight: 700 }}
        >
          Map ›
        </button>
      </div>
      {list.map((r) => (
        <div key={r.name} className="row" style={{ padding: "10px 12px", gap: 10 }}>
          <div className="ph ph-fire" style={{ width: 40, height: 40, borderRadius: "var(--m-r-tile)", flex: "none" }} />
          <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
            <span className="t-h2" style={{ fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
            <span className="t-cap">{[r.area, r.priceRange].filter(Boolean).join(" · ")}</span>
          </div>
          <CarrotRating value={Math.round(Number(r.rating) || 4)} size={13} />
        </div>
      ))}
    </div>
  );
}
