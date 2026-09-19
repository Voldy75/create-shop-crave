"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, History, Sparkles, Trash2 } from "lucide-react";
import { getActiveRecipe, getBuyList, setBuyList } from "@/lib/mobile-handoff";
import { parseNumeric } from "@/lib/nutrition";
import { looksPantry } from "@/lib/pantry";
import { mascotComponentFor, tileTint } from "@/lib/ingredient-mascot";
import { buildBlinkitLink, buildSwiggyInstamartLink, buildInstacartLink } from "@/lib/deeplinks";
import { BoBowl, MascotFor } from "@/components/mascots";
import {
  listGroceryRuns,
  recordGroceryRun,
  clearGroceryRuns,
  runDayLabel,
  STORE_LABELS,
  type GroceryRun,
  type GroceryStore,
} from "@/lib/grocery-history";
import type { Ingredient } from "@/lib/types";

/**
 * Cart — built to artboard w4a's LAYOUT, not its content.
 *
 * ── Read this before "finishing" the screen against the artboard ──
 *
 * w4a draws a complete Swiggy Instamart checkout: catalogue products with
 * photos and brand names, quantity steppers, a saved delivery address, a
 * ~15 min ETA, a ₹49 delivery fee, a "Bo's tip jar" line, and a "Place order"
 * button. Almost none of that is backed on web, and inventing it is precisely
 * the bug class this project has already shipped once (the paywall hardcoded
 * ₹2,990/₹399 against a real ₹749). Specifically:
 *
 *   - **No product catalogue.** Ingredients are LLM-generated strings with an
 *     estimated price. There are no SKUs, no brands ("Fresho", "Milky Mist"),
 *     and no product photography. Mascot tiles stand in — the same mapping the
 *     recipe view uses, and what DESIGN.md requires for ingredient-level tiles.
 *   - **No quantity units.** `Ingredient.quantity` is free text ("½ cup",
 *     "1 ripe"). A − / + stepper implies a countable unit we do not have, so
 *     rows are INCLUDE / EXCLUDE instead — which is also the real interaction,
 *     since the useful question is "do I already own this?".
 *   - **No address, ETA, or fees.** Addresses exist only inside the Swiggy MCP
 *     agent (`get_addresses`), which Dead End 1 says rejects our web origin.
 *     `deliveryFee` and any tipping concept appear nowhere in the codebase.
 *     The rail therefore shows a subtotal only, labelled as an estimate.
 *   - **No order placement or tracking from web.** There is no orders table and
 *     no platform reports state back, so there is no "Place order" button and
 *     no "Bo tracks this for you" claim. The rail hands off to the agent or to
 *     a deeplink, which is what actually happens.
 *
 * The Instamart agent card keeps a plain deeplink beside it for the same
 * reason `/m/buy/platform` does: Swiggy's OAuth can reject us for reasons the
 * user cannot fix, and without the fallback there is no way to reach Instamart
 * at all.
 */

const EMPTY: Ingredient[] = [];

export default function CartPage() {
  // Suspense so useSearchParams below doesn't trigger a static-rendering
  // bailout warning under Next 16 — same shape as chat and planner.
  return (
    <Suspense fallback={null}>
      <CartPageInner />
    </Suspense>
  );
}

function CartPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [items, setItems] = useState<Ingredient[]>(EMPTY);
  const [recipeName, setRecipeName] = useState<string | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  /* ITEM 6 — the 7-day record of what was sent to a store. */
  const [runs, setRuns] = useState<GroceryRun[]>([]);

  /* The rail highlights whichever store the caller asked for, so arriving from
     chat's "Send to Blinkit" lands with Blinkit already picked out instead of
     making the user find it again. */
  const preferredStore = params.get("store");

  useEffect(() => {
    // sessionStorage read after mount — cannot run during SSR. Same handoff the
    // mobile buy flow uses, so a recipe opened on either surface lands here.
    /* eslint-disable react-hooks/set-state-in-effect */
    const list = getBuyList();
    const recipe = getActiveRecipe();
    const source = list?.items ?? recipe?.ingredients ?? EMPTY;
    setItems(source);
    setRecipeName(list?.recipeName ?? recipe?.name ?? null);
    // Pre-deselect probable pantry staples, exactly as /m/buy does.
    setOff(new Set(source.filter((i) => looksPantry(i.item)).map((i) => i.item)));
    setRuns(listGroceryRuns());
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const selected = useMemo(() => items.filter((i) => !off.has(i.item)), [items, off]);
  const pantryHits = useMemo(() => items.filter((i) => looksPantry(i.item)), [items]);
  const subtotal = Math.round(selected.reduce((s, i) => s + parseNumeric(i.price), 0));
  const pantrySaving = Math.round(pantryHits.reduce((s, i) => s + parseNumeric(i.price), 0));

  const query = selected.map((i) => i.item).join(", ") || recipeName || "groceries";
  const agentPrompt = `Order these ingredients on Instamart: ${selected
    .map((i) => `${i.item}${i.quantity ? ` (${i.quantity})` : ""}`)
    .join(", ")}. Use my saved address.`;

  const toggle = (item: string) =>
    setOff((cur) => {
      const next = new Set(cur);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });

  /**
   * ITEM 6 — record the hand-off. Called from every path that actually sends
   * the list somewhere, with the SELECTION at that moment, so the record
   * matches what the store received rather than the full recipe.
   */
  const record = useCallback(
    (store: GroceryStore) => {
      recordGroceryRun({ recipeName, items: selected, subtotal, store });
      setRuns(listGroceryRuns());
    },
    [recipeName, selected, subtotal]
  );

  /** Carry the ACTUAL selection to the agent, or deselecting was theatre. */
  const askBo = () => {
    if (recipeName) setBuyList({ recipeName, items: selected });
    record("agent");
    router.push(`/chat?agent=1&q=${encodeURIComponent(agentPrompt)}`);
  };

  if (!hydrated) return <div style={{ height: "100%", background: "var(--m-cream)" }} />;

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col" style={{ background: "var(--m-cream)" }}>
        <div className="topbar">
          <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
            <span className="t-cap">Nothing added yet</span>
            <span className="t-d2">Your cart</span>
          </div>
        </div>
        <div className="vstack" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
          <BoBowl width={72} height={72} className="mm-idle-bo-bowl" />
          <span className="t-h1">Nothing to buy yet</span>
          <span className="t-body-soft" style={{ maxWidth: 300 }}>
            Ask Bo for a recipe, then send its ingredients here.
          </span>
          <button className="pill-primary" style={{ padding: "0 22px" }} onClick={() => router.push("/chat")}>
            Find something to cook
          </button>
        </div>

        {/* An empty cart is the MOST likely way to arrive here from the sidebar,
            so this is exactly where last week's lists matter. The early return
            above used to hide them completely. */}
        {runs.length > 0 && (
          <div style={{ padding: "0 24px 28px", maxWidth: 820, margin: "0 auto", width: "100%" }}>
            <RecentRuns runs={runs} onClear={() => { clearGroceryRuns(); setRuns([]); }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full cart-page" style={{ background: "var(--m-cream)" }}>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── Topbar — w4a. States what this list IS, rather than an ETA we
            cannot know. ── */}
        <div className="topbar" style={{ gap: 14, flexWrap: "wrap", minHeight: 74, height: "auto" }}>
          <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
            <span className="t-cap" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {recipeName ? `From ${recipeName}` : "Shopping list"} · prices are estimates
            </span>
            <span className="t-d2" style={{ whiteSpace: "nowrap" }}>Your cart</span>
          </div>
          <span className="chip-tag chip">{selected.length} of {items.length}</span>
        </div>

        <div className="mbody" style={{ overflow: "auto" }}>
          <div className="vstack" style={{ gap: 14 }}>
            {/* Bo's smart check — a real heuristic (lib/pantry.ts), and the
                copy says "probably" because there is no pantry table. */}
            {pantryHits.length > 0 && (
              <div className="card tint-lav hstack" style={{ boxShadow: "none", padding: "12px 16px", gap: 12 }}>
                <BoBowl width={34} height={34} style={{ flex: "none" }} />
                <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
                  <span className="t-micro" style={{ color: "var(--m-plum)" }}>Smart check</span>
                  <span className="t-body" style={{ color: "var(--m-plum)" }}>
                    You probably already have{" "}
                    {pantryHits.slice(0, 2).map((p) => p.item.toLowerCase()).join(" & ")}
                    {pantrySaving > 0 ? `. Skipping saves about ₹${pantrySaving}.` : "."}
                  </span>
                </div>
              </div>
            )}

            <div className="hstack" style={{ justifyContent: "space-between" }}>
              <span className="t-micro">{items.length} item{items.length === 1 ? "" : "s"}</span>
              {off.size > 0 && (
                <button
                  onClick={() => setOff(new Set())}
                  className="wlink"
                  style={{ background: "none", border: "none", color: "var(--m-forest)" }}
                >
                  Select all
                </button>
              )}
            </div>

            {items.map((it, i) => {
              const on = !off.has(it.item);
              const Mascot = mascotComponentFor(it.item);
              return (
                <button
                  key={it.item}
                  onClick={() => toggle(it.item)}
                  aria-pressed={on}
                  className="row wtile"
                  style={{
                    padding: "12px 16px",
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    opacity: on ? 1 : 0.55,
                  }}
                >
                  <span
                    className={`hstack ${tileTint(i)}`}
                    style={{ width: 56, height: 56, borderRadius: 13, justifyContent: "center", flex: "none" }}
                  >
                    <Mascot width={38} height={38} />
                  </span>

                  <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
                    <span
                      className="t-h2"
                      style={{
                        fontSize: 15,
                        textDecoration: on ? "none" : "line-through",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {it.item}
                    </span>
                    <span className="t-cap">
                      {[it.quantity, looksPantry(it.item) ? "likely in your pantry" : null]
                        .filter(Boolean)
                        .join(" · ") || " "}
                    </span>
                  </div>

                  <span className="t-h2" style={{ width: 62, textAlign: "right", flex: "none" }}>{it.price}</span>

                  {/* Include / exclude, not a quantity stepper — `quantity` is
                      free text, so there is no unit to step. */}
                  <span
                    className="hstack"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      justifyContent: "center",
                      flex: "none",
                      background: on ? "var(--m-forest)" : "transparent",
                      boxShadow: on ? "none" : "inset 0 0 0 2px var(--m-ink-faint)",
                      color: "var(--m-on-deep)",
                    }}
                  >
                    {on && <Check width={15} height={15} />}
                  </span>
                </button>
              );
            })}
          </div>

          <RecentRuns runs={runs} onClear={() => { clearGroceryRuns(); setRuns([]); }} style={{ marginTop: 18 }} />
        </div>
      </div>

      {/* ── Summary rail — w4a, minus everything we cannot compute ── */}
      <aside className="rail cart-rail" aria-label="Order summary">
        <span className="t-micro">Order summary</span>
        <div className="card" style={{ padding: 18 }}>
          <div className="vstack" style={{ gap: 11 }}>
            <div className="hstack" style={{ justifyContent: "space-between" }}>
              <span className="t-body-soft">{selected.length} item{selected.length === 1 ? "" : "s"}</span>
              <span className="t-body">₹{subtotal}</span>
            </div>
            {off.size > 0 && (
              <div className="hstack" style={{ justifyContent: "space-between" }}>
                <span className="t-body-soft">Skipped</span>
                <span className="t-body-soft">{off.size}</span>
              </div>
            )}
            <i style={{ height: 1.5, background: "var(--m-ink-faint)", display: "block" }} />
            <div className="hstack" style={{ justifyContent: "space-between" }}>
              <span className="t-h2">Estimated</span>
              <span className="t-h2" style={{ color: "var(--m-forest)" }}>₹{subtotal}</span>
            </div>
            {/* Deliberately explicit. These are the recipe's own estimates, not
                live prices — no platform gives us a price feed. */}
            <span className="t-cap">
              Estimated from the recipe. The store&rsquo;s prices, delivery and any
              fees are settled in their checkout.
            </span>
          </div>
        </div>

        <span className="t-micro">Where to buy</span>

        {/* Instamart is the only platform Bo can actually transact with, so it
            is the raised card; the rest can only open a pre-searched app. */}
        <div
          className="card tint-green"
          style={{
            padding: 14,
            boxShadow: preferredStore === "instamart" ? "inset 0 0 0 2px var(--m-forest)" : "none",
          }}
        >
          <div className="hstack" style={{ gap: 10, marginBottom: 10 }}>
            <Sparkles width={18} height={18} style={{ color: "var(--m-forest)", flex: "none" }} />
            <span className="t-h2" style={{ fontSize: 14 }}>Swiggy Instamart</span>
          </div>
          <span className="t-cap" style={{ color: "var(--m-forest)" }}>
            Bo builds the cart and asks you before placing anything.
          </span>
          <button className="pill-primary" style={{ width: "100%", marginTop: 12 }} onClick={askBo} disabled={selected.length === 0}>
            Ask Bo to order
          </button>
          {/* Swiggy's MCP OAuth can reject this origin (Dead End 1) for reasons
              the user cannot fix. Without this there is no route to Instamart. */}
          <a
            href={buildSwiggyInstamartLink(query)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => record("instamart")}
            className="wlink"
            style={{ marginTop: 10, justifyContent: "center", width: "100%", color: "var(--m-forest)" }}
          >
            or open Instamart yourself <ExternalLink width={13} height={13} />
          </a>
        </div>

        <div className="vstack" style={{ gap: 8 }}>
          <StoreLink
            label="Blinkit"
            href={buildBlinkitLink(query)}
            onSend={() => record("blinkit")}
            highlight={preferredStore === "blinkit"}
          />
          <StoreLink
            label="Instacart"
            href={buildInstacartLink(query)}
            onSend={() => record("instacart")}
            highlight={preferredStore === "instacart"}
          />
        </div>

        <div className="grow" />
      </aside>
    </div>
  );
}

/**
 * ITEM 6 — the 7-day record of what was SENT to a store.
 *
 * NOTE THE WORDING, and do not "improve" it: no platform reports a completed
 * order back to this app, so all we know is that the user opened a store with a
 * list. Calling these purchases or deliveries would be the same fabrication as
 * w4a's "Bo places & tracks this order for you", which this screen already
 * declined to build.
 */
function RecentRuns({
  runs,
  onClear,
  style,
}: {
  runs: GroceryRun[];
  onClear: () => void;
  style?: React.CSSProperties;
}) {
  if (runs.length === 0) return null;
  return (
    <div className="card vstack" style={{ padding: 18, gap: 14, ...style }}>
      <div className="hstack" style={{ gap: 10, flexWrap: "wrap" }}>
        <History width={18} height={18} style={{ color: "var(--m-forest)", flex: "none" }} aria-hidden />
        <span className="t-d2" style={{ fontSize: 18 }}>Recently sent</span>
        <span className="chip pill-sm">{runs.length}</span>
        <div className="grow" />
        <button className="chip pill-sm" onClick={onClear} aria-label="Clear the sent-list history">
          <Trash2 width={13} height={13} aria-hidden /> Clear
        </button>
      </div>

      <div className="vstack" style={{ gap: 9 }}>
        {runs.map((run) => (
          <div
            key={run.id}
            className="row"
            style={{ padding: "12px 14px", boxShadow: "none", background: "var(--m-cream)", alignItems: "flex-start" }}
          >
            <div className="vstack grow" style={{ gap: 4, minWidth: 0 }}>
              <div className="hstack" style={{ gap: 8, flexWrap: "wrap" }}>
                <span className="t-h2" style={{ fontSize: 14 }}>{run.recipeName ?? "Shopping list"}</span>
                <span className="t-cap">
                  {runDayLabel(run.at)} · sent to {STORE_LABELS[run.store]}
                </span>
              </div>
              <div className="hstack" style={{ gap: 6, flexWrap: "wrap" }}>
                {run.items.slice(0, 6).map((it) => (
                  <span key={it.item} className="hstack" style={{ gap: 4 }}>
                    <MascotFor name={it.item} width={18} height={18} aria-hidden />
                    <span className="t-cap">{it.item}</span>
                  </span>
                ))}
                {run.items.length > 6 && <span className="t-cap">+{run.items.length - 6} more</span>}
              </div>
            </div>
            <span className="vstack" style={{ gap: 1, alignItems: "flex-end", flex: "none" }}>
              <span className="t-h2" style={{ fontSize: 14 }}>~₹{run.subtotal}</span>
              <span className="t-cap">{run.items.length} item{run.items.length === 1 ? "" : "s"}</span>
            </span>
          </div>
        ))}
      </div>

      <span className="t-cap">
        Kept 7 days on this device, then cleared. These are lists you sent to a store —
        meshi isn&rsquo;t told what you actually bought.
      </span>
    </div>
  );
}

/** A store we can only hand a search query to — never presented as checkout. */
function StoreLink({
  label,
  href,
  onSend,
  highlight,
}: {
  label: string;
  href: string;
  onSend: () => void;
  highlight?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onSend}
      className="row"
      style={{
        padding: "11px 14px",
        background: "var(--m-cream)",
        boxShadow: highlight ? "inset 0 0 0 2px var(--m-forest)" : "none",
      }}
    >
      <span className="t-h2 grow" style={{ fontSize: 14 }}>{label}</span>
      <span className="t-cap">opens search</span>
      <ExternalLink width={14} height={14} style={{ color: "var(--m-ink-soft)", flex: "none" }} />
    </a>
  );
}
