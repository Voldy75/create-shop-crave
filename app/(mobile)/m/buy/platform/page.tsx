"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Sparkles } from "lucide-react";
import { getActiveRecipe, getBuyList } from "@/lib/mobile-handoff";
import { parseNumeric } from "@/lib/nutrition";
import { buildBlinkitLink, buildSwiggyInstamartLink, buildInstacartLink } from "@/lib/deeplinks";
import { BoBowl, Carrot } from "@/components/mascots";
import type { Ingredient } from "@/lib/types";

/**
 * Buy ② — where to buy, built to the Flow 4 artboard (4e).
 *
 * The artboard's hierarchy is the point: Instamart is a raised card with an
 * inset forest ring because it is the only platform meshi can actually
 * TRANSACT with (Bo builds and places the cart). Everything else is a plain
 * list row, because all those can do is open their own app with the list
 * pre-searched. Presenting them as equals would overstate what we do.
 *
 * The artboard also shows per-platform stock and pricing. No platform exposes
 * that to us, so the only numbers here are the ones we computed ourselves.
 *
 * Reads the SELECTION from /m/buy (BuyList), not the whole recipe — skipping
 * pantry staples has to survive the navigation or the pre-check was theatre.
 */

export default function BuyPlatform() {
  const router = useRouter();
  const [items, setItems] = useState<Ingredient[]>([]);
  const [recipeName, setRecipeName] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const list = getBuyList();
    if (list) {
      setItems(list.items);
      setRecipeName(list.recipeName);
    } else {
      // Direct visit with no pre-check — fall back to the whole recipe.
      const r = getActiveRecipe();
      setItems(r?.ingredients ?? []);
      setRecipeName(r?.name ?? null);
    }
    setHydrated(true);
  }, []);

  const est = Math.round(items.reduce((s, i) => s + parseNumeric(i.price), 0));
  const query = items.map((i) => i.item).join(", ") || recipeName || "groceries";
  const agentPrompt = `Order these ingredients on Instamart: ${items
    .map((i) => `${i.item}${i.quantity ? ` (${i.quantity})` : ""}`)
    .join(", ")}. Use my saved address.`;

  const deeplinks = [
    { id: "blinkit", name: "Blinkit", eta: "~10 min · opens Blinkit search", letter: "B", tint: "tint-green", ink: "var(--m-forest)", href: buildBlinkitLink(query) },
    { id: "instacart", name: "Instacart", eta: "~2 hrs · opens Instacart search", letter: "I", tint: "tint-lav", ink: "var(--m-plum)", href: buildInstacartLink(query) },
  ];

  if (!hydrated) return <div style={{ minHeight: "100dvh", background: "var(--m-cream)" }} />;

  return (
    <div className="vstack" style={{ minHeight: "100dvh", background: "var(--m-cream)", padding: "calc(env(safe-area-inset-top, 12px) + 8px) 20px 30px", gap: 12 }}>
      <div className="hstack">
        <button className="icon-btn" onClick={() => router.back()} aria-label="Back"><ArrowLeft width={20} height={20} /></button>
        <span className="t-h1 grow" style={{ textAlign: "center", marginRight: 42 }}>Where to buy</span>
      </div>

      <div className="hstack" style={{ justifyContent: "space-between", padding: "0 4px", gap: 10 }}>
        <div className="vstack" style={{ gap: 0, minWidth: 0 }}>
          <span className="t-micro">Your cart</span>
          <span className="t-h2" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {items.length} ingredient{items.length === 1 ? "" : "s"}{recipeName ? ` · ${recipeName}` : ""}
          </span>
        </div>
        {est > 0 && <span className="chip-tag chip" style={{ flex: "none" }}>~₹{est}</span>}
      </div>

      {/* Instamart — the only platform we can transact with */}
      <div className="card vstack" style={{ padding: 16, gap: 10, boxShadow: "inset 0 0 0 2.5px var(--m-forest), var(--m-shadow)" }}>
        <div className="hstack">
          <span
            className="mascot-tile tint-peach"
            style={{ width: 44, height: 44, borderRadius: 14, flex: "none", font: "800 18px var(--m-font-display)", color: "var(--m-burnt)" }}
          >
            S
          </span>
          <div className="vstack grow" style={{ gap: 0, minWidth: 0 }}>
            <span className="t-h2">Swiggy Instamart</span>
            <span className="t-cap">~15 min delivery</span>
          </div>
          <span className="chip-tag chip" style={{ background: "var(--m-tint-lav)", color: "var(--m-plum)", gap: 4, flex: "none" }}>
            <Sparkles width={12} height={12} /> Agent
          </span>
        </div>
        <div className="card tint-green hstack" style={{ boxShadow: "none", padding: "10px 12px", gap: 10 }}>
          <BoBowl width={28} height={28} style={{ flex: "none" }} />
          <span className="t-cap" style={{ color: "var(--m-forest-2)" }}>
            Bo builds the cart and places the order in-app. You just approve.
          </span>
        </div>
        <button
          className="pill-primary"
          style={{ width: "100%", height: 44 }}
          onClick={() => router.push(`/m/chat?agent=1&q=${encodeURIComponent(agentPrompt)}`)}
        >
          Order via meshi
        </button>
        {/* The artboard's card offers only the agent. But Swiggy's MCP OAuth
            gates to an allowlist of AI clients and rejects our origin (Dead End
            1 in handoff.md), so the agent path can fail for reasons the user
            cannot fix. Without this fallback there would be no way to reach
            Instamart at all. */}
        <a
          href={buildSwiggyInstamartLink(query)}
          target="_blank"
          rel="noopener noreferrer"
          className="t-cap"
          style={{ textAlign: "center", color: "var(--m-ink-soft)" }}
        >
          or open Instamart yourself
        </a>
      </div>

      {/* Deeplink-only platforms */}
      {deeplinks.map((p) => (
        <a key={p.id} className="row" href={p.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
          <span
            className={`mascot-tile ${p.tint}`}
            style={{ width: 44, height: 44, borderRadius: 14, flex: "none", font: "800 18px var(--m-font-display)", color: p.ink }}
          >
            {p.letter}
          </span>
          <div className="vstack grow" style={{ gap: 0, minWidth: 0 }}>
            <span className="t-h2">{p.name}</span>
            <span className="t-cap">{p.eta}</span>
          </div>
          <ChevronRight width={18} height={18} style={{ color: "var(--m-ink-soft)", flex: "none" }} />
        </a>
      ))}

      <div className="grow" />

      <div className="toast tint-peach" style={{ boxShadow: "none" }}>
        <Carrot width={30} height={30} style={{ flex: "none" }} />
        <span>Deeplinks open the platform with your list pre-searched.</span>
      </div>
    </div>
  );
}
