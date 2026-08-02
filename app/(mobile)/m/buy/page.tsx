"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { getActiveRecipe, setBuyList } from "@/lib/mobile-handoff";
import { parseNumeric } from "@/lib/nutrition";
import { mascotComponentFor, tileTint } from "@/lib/ingredient-mascot";
import { foodImage } from "@/lib/food-images";
import { BoBowl } from "@/components/mascots";
import type { RecipeData } from "@/lib/types";

/**
 * Buy ① — ingredients pre-check, built to the Flow 4 artboard (4d).
 *
 * The artboard's idea is that this is not a plain checklist: Bo pre-deselects
 * what you probably already own and tells you what that saved. Skipped rows
 * keep their price visible but go struck-through and dimmed, so the saving is
 * legible rather than implied.
 *
 * Ingredient rows use the mascot tiles from lib/ingredient-mascot, the same
 * mapping the recipe screen uses, so an ingredient looks like itself
 * everywhere.
 *
 * Pantry detection is a heuristic over common staples — there is no pantry
 * table. That is why the copy says "probably" and every row stays togglable.
 */

const PANTRY_STAPLES = ["butter", "garam masala", "salt", "oil", "sugar", "pepper", "ginger-garlic", "flour"];

function looksPantry(name: string): boolean {
  const n = name.toLowerCase();
  return PANTRY_STAPLES.some((s) => n.includes(s));
}

export default function BuyPrecheck() {
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeData | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [off, setOff] = useState<Set<string>>(new Set());

  useEffect(() => {
    const r = getActiveRecipe();
    setRecipe(r);
    if (r) setOff(new Set(r.ingredients.filter((i) => looksPantry(i.item)).map((i) => i.item)));
    setHydrated(true);
  }, []);

  const items = useMemo(() => recipe?.ingredients ?? [], [recipe]);
  const pantryHits = useMemo(() => items.filter((i) => looksPantry(i.item)), [items]);
  const selected = items.filter((i) => !off.has(i.item));
  const subtotal = Math.round(selected.reduce((s, i) => s + parseNumeric(i.price), 0));
  const pantrySaving = Math.round(pantryHits.reduce((s, i) => s + parseNumeric(i.price), 0));

  const toggle = (item: string) =>
    setOff((cur) => {
      const next = new Set(cur);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });

  const onContinue = () => {
    if (!recipe) return;
    // Carry the ACTUAL selection forward — see lib/mobile-handoff BuyList.
    setBuyList({ recipeName: recipe.name, items: selected });
    router.push("/m/buy/platform");
  };

  if (!hydrated) return <div style={{ minHeight: "100dvh", background: "var(--m-cream)" }} />;

  if (!recipe) {
    return (
      <div className="vstack" style={{ minHeight: "100dvh", background: "var(--m-cream)", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
        <BoBowl width={72} height={72} />
        <span className="t-h1">Nothing to buy yet</span>
        <span className="t-body-soft" style={{ maxWidth: 260 }}>Pick a recipe first and Bo will turn it into a shopping list.</span>
        <button className="pill-primary" style={{ width: "auto", padding: "0 22px" }} onClick={() => router.push("/m/chat")}>Find something to cook</button>
      </div>
    );
  }

  const img = foodImage(recipe.name);

  return (
    /* height (not minHeight) + overflow hidden: the ingredient list is the only
       scrolling region, which keeps the Continue bar — and the total on it —
       pinned in view. With minHeight the list grows the page instead and the
       primary action drops below the fold. */
    <div className="vstack" style={{ height: "100dvh", overflow: "hidden", background: "var(--m-cream)", padding: "calc(env(safe-area-inset-top, 12px) + 8px) 20px calc(20px + env(safe-area-inset-bottom, 0px))", gap: 12 }}>
      <div className="hstack">
        <button className="icon-btn" onClick={() => router.back()} aria-label="Back"><ArrowLeft width={20} height={20} /></button>
        <span className="t-h1 grow" style={{ textAlign: "center", marginRight: 42 }}>Buy ingredients</span>
      </div>

      {/* Recipe */}
      <div className="hstack" style={{ gap: 10 }}>
        <div
          className={img ? "imgfill" : "ph ph-saffron"}
          style={{ width: 44, height: 44, borderRadius: 12, flex: "none", backgroundImage: img ? `url(${img})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}
        />
        <div className="vstack grow" style={{ gap: 0, minWidth: 0 }}>
          <span className="t-h2" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{recipe.name}</span>
          <span className="t-cap">
            {recipe.servings ? `${recipe.servings} serving${recipe.servings === 1 ? "" : "s"} · ` : ""}{items.length} ingredients
          </span>
        </div>
      </div>

      {/* Smart check */}
      {pantryHits.length > 0 && (
        <div className="card tint-lav hstack" style={{ boxShadow: "none", padding: "12px 14px", gap: 12 }}>
          <BoBowl width={34} height={34} style={{ flex: "none" }} />
          <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
            <span className="t-micro" style={{ color: "var(--m-plum)" }}>Smart check</span>
            <span className="t-body" style={{ color: "var(--m-plum)" }}>
              You probably have {pantryHits.slice(0, 2).map((p) => p.item.toLowerCase()).join(" & ")}
              {pantrySaving > 0 ? `. Skipping saves ~₹${pantrySaving}.` : "."}
            </span>
          </div>
        </div>
      )}

      <div className="hstack" style={{ justifyContent: "space-between", padding: "0 4px" }}>
        <span className="t-micro">{selected.length} of {items.length} selected</span>
        <button
          onClick={() => setOff(new Set())}
          className="t-micro"
          style={{ background: "none", border: "none", padding: 0, color: "var(--m-forest)" }}
        >
          Select all
        </button>
      </div>

      <div className="scroll vstack" style={{ flex: 1, gap: 10, paddingBottom: 12 }}>
        {items.map((it, i) => {
          const on = !off.has(it.item);
          const Mascot = mascotComponentFor(it.item);
          const pantry = looksPantry(it.item);
          return (
            <button
              key={it.item}
              onClick={() => toggle(it.item)}
              aria-pressed={on}
              className="row"
              style={{ padding: "10px 14px", width: "100%", textAlign: "left", border: "none", opacity: on ? 1 : 0.5 }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 8,
                  flex: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: on ? "var(--m-forest)" : "transparent",
                  boxShadow: on ? "none" : "inset 0 0 0 2px var(--m-ink-faint)",
                }}
              >
                {on && <Check width={14} height={14} style={{ color: "var(--m-on-deep)" }} />}
              </span>
              <span className={`mascot-tile ${tileTint(i)}`} style={{ width: 38, height: 38, padding: 5, flex: "none" }}>
                <Mascot width={26} height={26} />
              </span>
              <div className="vstack grow" style={{ gap: 0, minWidth: 0 }}>
                <span className="t-h2" style={{ fontSize: 15, textDecoration: on ? "none" : "line-through" }}>{it.item}</span>
                <span className="t-cap">{!on && pantry ? "In your pantry, probably" : (it.quantity ?? "")}</span>
              </div>
              {it.price && <span className="t-body" style={{ flex: "none" }}>{it.price}</span>}
            </button>
          );
        })}
      </div>

      {/* The artboard puts the count and the total on one bar — the two numbers
          a user checks before committing. */}
      <button
        className="pill-primary"
        disabled={selected.length === 0}
        style={{ width: "100%", justifyContent: "space-between", padding: "0 22px", opacity: selected.length ? 1 : 0.5 }}
        onClick={onContinue}
      >
        <span>Continue · {selected.length} item{selected.length === 1 ? "" : "s"}</span>
        {subtotal > 0 && <span>~₹{subtotal}</span>}
      </button>
    </div>
  );
}
