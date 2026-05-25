"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Check, Sparkles } from "lucide-react";
import { getActiveRecipe } from "@/lib/mobile-handoff";
import { parseNumeric } from "@/lib/nutrition";
import type { RecipeData } from "@/lib/types";

/**
 * meshi Buy journey ① — Ingredients pre-check (v2-buy-journey ScreenIngredientsCheck).
 * Review what's about to be bought, toggle items, and (the differentiator) a
 * "smart check" that flags items likely already in the pantry so the user can
 * deselect and save. Reads the recipe handed off from the recipe/chat screen.
 *
 * Pantry detection here is a heuristic (common staples) — no persistent pantry
 * table yet (that's a documented future option). Steps ②platform ③cart
 * ④confirmed land in the next batch; "Continue" routes onward.
 */

const PANTRY_STAPLES = ["butter", "garam masala", "salt", "oil", "sugar", "pepper", "ginger-garlic", "flour"];

function looksPantry(name: string): boolean {
  const n = name.toLowerCase();
  return PANTRY_STAPLES.some((s) => n.includes(s));
}

export default function BuyPrecheck() {
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeData | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());

  useEffect(() => {
    const r = getActiveRecipe();
    setRecipe(r);
    // Pre-deselect likely-pantry items.
    if (r) setOff(new Set(r.ingredients.filter((i) => looksPantry(i.item)).map((i) => i.item)));
  }, []);

  const items = recipe?.ingredients ?? [];
  const pantryHits = useMemo(() => items.filter((i) => looksPantry(i.item)), [items]);
  const selected = items.filter((i) => !off.has(i.item));
  const subtotal = selected.reduce((s, i) => s + parseNumeric(i.price), 0);
  const pantrySaving = pantryHits.reduce((s, i) => s + parseNumeric(i.price), 0);

  const toggle = (item: string) =>
    setOff((cur) => {
      const next = new Set(cur);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });

  if (!recipe) {
    return (
      <div className="col" style={{ minHeight: "100dvh", background: "var(--cc-bg)", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
        <p className="t-body">No recipe selected.</p>
        <button className="pill-primary" style={{ width: "auto", padding: "12px 22px" }} onClick={() => router.push("/m/chat")}>Find something to cook</button>
      </div>
    );
  }

  return (
    <div className="col" style={{ minHeight: "100dvh", background: "var(--cc-bg)" }}>
      {/* Header */}
      <div className="glass row" style={{ padding: "calc(env(safe-area-inset-top,12px) + 6px) 14px 8px", justifyContent: "space-between", borderBottom: "1px solid var(--cc-line)", position: "sticky", top: 0, zIndex: 5 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--cc-ink-1)" }} aria-label="Back"><ChevronLeft width={22} height={22} /></button>
        <div className="t-h3">Buy ingredients</div>
        <span style={{ width: 22 }} />
      </div>

      {/* Recipe pill */}
      <div className="row" style={{ padding: "12px 16px", gap: 10, borderBottom: "1px solid var(--cc-line)" }}>
        <div className="ph ph-saffron" style={{ width: 44, height: 44, borderRadius: "var(--cc-r-md)", flexShrink: 0 }} />
        <div className="col" style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{recipe.name}</span>
          <span className="t-small">{recipe.servings ? `${recipe.servings} servings · ` : ""}{items.length} ingredients</span>
        </div>
      </div>

      {/* Smart check */}
      {pantryHits.length > 0 && (
        <div className="row" style={{ margin: "12px 14px 0", padding: 12, gap: 10, background: "var(--cc-acc-soft)", borderRadius: "var(--cc-r-md)", border: "1px solid var(--cc-acc-dim)" }}>
          <Sparkles width={18} height={18} style={{ color: "var(--cc-acc)", flexShrink: 0, marginTop: 1 }} />
          <div className="col" style={{ gap: 2 }}>
            <span className="t-cap" style={{ color: "var(--cc-acc)" }}>SMART CHECK</span>
            <span className="t-small" style={{ color: "var(--cc-ink-1)", lineHeight: 1.4 }}>
              Looks like you may already have {pantryHits.map((p) => p.item.split(" ")[0]).slice(0, 2).join(" & ")}. Skipping saves ~₹{pantrySaving}.
            </span>
          </div>
        </div>
      )}

      {/* List */}
      <div className="scroll" style={{ flex: 1, padding: "14px 14px 120px" }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8, padding: "0 4px" }}>
          <span className="t-cap">{selected.length} OF {items.length} SELECTED</span>
          <button onClick={() => setOff(new Set())} className="t-cap" style={{ background: "none", border: "none", color: "var(--cc-acc)", cursor: "pointer" }}>SELECT ALL</button>
        </div>
        <div className="col" style={{ gap: 8 }}>
          {items.map((it) => {
            const on = !off.has(it.item);
            return (
              <button key={it.item} onClick={() => toggle(it.item)} className="row" style={{ background: "var(--cc-surf-1)", borderRadius: "var(--cc-r-md)", border: "1px solid var(--cc-line)", padding: "10px 12px", gap: 10, opacity: on ? 1 : 0.55, textAlign: "left" }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: on ? "var(--cc-acc)" : "transparent", border: on ? "none" : "1.5px solid var(--cc-line-2)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  {on && <Check width={14} height={14} style={{ color: "#fff" }} />}
                </div>
                <div className="ph ph-cream" style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0 }} />
                <div className="col" style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, textDecoration: on ? "none" : "line-through" }}>{it.item}</span>
                  {it.quantity && <span className="t-small">{it.quantity}</span>}
                </div>
                {it.price && <span style={{ fontSize: 13, color: "var(--cc-ink-2)" }}>{it.price}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="glass" style={{ position: "fixed", left: 0, right: 0, bottom: 0, maxWidth: 520, margin: "0 auto", padding: "12px 16px calc(14px + env(safe-area-inset-bottom,0px))", borderTop: "1px solid var(--cc-line)" }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <span className="t-small">Estimated subtotal</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>₹{subtotal}</span>
        </div>
        <button
          className="pill-primary"
          disabled={selected.length === 0}
          style={{ opacity: selected.length ? 1 : 0.5 }}
          onClick={() => {
            // Functional path: hand the chosen items to the Swiggy agent, which
            // searches Instamart, builds the cart, and confirms before ordering.
            // (Dedicated platform/cart/confirmed screens are a later enhancement.)
            const list = selected.map((i) => `${i.item}${i.quantity ? ` (${i.quantity})` : ""}`).join(", ");
            const prompt = `Order these ingredients on Instamart: ${list}. Use my saved address.`;
            router.push(`/m/chat?agent=1&q=${encodeURIComponent(prompt)}`);
          }}
        >
          Order {selected.length} item{selected.length === 1 ? "" : "s"} on Instamart
        </button>
      </div>
    </div>
  );
}
