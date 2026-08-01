"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, Check, Zap, Bot } from "lucide-react";
import { getActiveRecipe } from "@/lib/mobile-handoff";
import { useUser } from "@/app/context/UserContext";
import { parseNumeric } from "@/lib/nutrition";
import { buildBlinkitLink, buildSwiggyInstamartLink, buildInstacartLink } from "@/lib/deeplinks";
import type { RecipeData } from "@/lib/types";

/**
 * meshi Buy ② — Platform compare (v2-buy-journey ScreenPlatformSelect),
 * grounded in real wiring. Each platform card deep-links to that app's search
 * for the recipe's ingredients (lib/deeplinks). Instamart additionally offers
 * "Order via meshi" → the Swiggy agent, which actually builds + places the cart.
 *
 * The design's per-platform stock/price/ETA is mock (needs each platform's API);
 * we show the agent path + real deeplinks instead of fabricated availability.
 */

export default function BuyPlatform() {
  const router = useRouter();
  const { location } = useUser();
  const [recipe, setRecipe] = useState<RecipeData | null>(null);

  useEffect(() => { setRecipe(getActiveRecipe()); }, []);

  const items = recipe?.ingredients ?? [];
  const est = items.reduce((s, i) => s + parseNumeric(i.price), 0);
  const query = items.map((i) => i.item).join(", ") || (recipe?.name ?? "groceries");
  const agentPrompt = `Order these ingredients on Instamart: ${items.map((i) => `${i.item}${i.quantity ? ` (${i.quantity})` : ""}`).join(", ")}. Use my saved address.`;

  const platforms = [
    { id: "instamart", name: "Swiggy Instamart", eta: "~15 min", note: "Order in-app via meshi", href: buildSwiggyInstamartLink(query), agent: true, badge: "AGENT", best: true },
    { id: "blinkit", name: "Blinkit", eta: "~10 min", note: "Opens Blinkit search", href: buildBlinkitLink(query) },
    { id: "instacart", name: "Instacart", eta: "~2 hrs", note: "Opens Instacart search", href: buildInstacartLink(query) },
  ];

  return (
    <div className="col" style={{ minHeight: "100dvh", background: "var(--m-cream)" }}>
      <div className="glass hstack" style={{ padding: "calc(env(safe-area-inset-top,12px) + 6px) 14px 8px", justifyContent: "space-between", borderBottom: "1px solid var(--m-ink-faint)", position: "sticky", top: 0, zIndex: 5 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--m-ink)" }} aria-label="Back"><ChevronLeft width={22} height={22} /></button>
        <div className="t-h3">Where to buy</div>
        <span style={{ width: 22 }} />
      </div>

      <div className="scroll" style={{ flex: 1, padding: "14px 14px 24px" }}>
        <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 14, padding: "0 4px" }}>
          <div className="col">
            <span className="t-cap">YOUR CART</span>
            <span style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{items.length} ingredients{recipe ? ` · ${recipe.name}` : ""}</span>
          </div>
          {est > 0 && <span className="chip" style={{ fontSize: 11 }}>~₹{est}</span>}
        </div>

        <div className="col" style={{ gap: 12 }}>
          {platforms.map((p) => (
            <div key={p.id} className="card" style={{ padding: 14, position: "relative", borderColor: p.best ? "var(--m-forest)" : "var(--m-ink-faint)", borderWidth: p.best ? 1.5 : 1 }}>
              {p.badge && (
                <span style={{ position: "absolute", top: -8, left: 14, background: "var(--m-forest)", color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", padding: "3px 8px", borderRadius: 4 }}>{p.badge}</span>
              )}
              <div className="hstack" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</span>
                <span className="hstack" style={{ gap: 4, color: "var(--m-ink-soft)" }}><Zap width={12} height={12} style={{ color: "var(--m-forest)" }} /><span style={{ fontSize: 13, fontWeight: 600 }}>{p.eta}</span></span>
              </div>
              <span className="t-small" style={{ fontSize: 12 }}>{p.note}</span>
              <div className="hstack" style={{ gap: 6, marginTop: 12 }}>
                {p.agent && (
                  <button className="pill-primary" style={{ flex: 1, padding: "9px 12px", fontSize: 13 }} onClick={() => router.push(`/m/chat?agent=1&q=${encodeURIComponent(agentPrompt)}`)}>
                    <Bot width={14} height={14} /> Order via meshi
                  </button>
                )}
                <a className="pill-tonal" style={{ flex: p.agent ? "0 0 auto" : 1, padding: "9px 14px", fontSize: 13, textDecoration: "none", justifyContent: "center" }} href={p.href} target="_blank" rel="noopener noreferrer">
                  Open app
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: 16, padding: 14, display: "flex", gap: 10, alignItems: "flex-start", background: "var(--m-tint-green)", borderColor: "var(--m-tint-green)" }}>
          <Check width={18} height={18} style={{ color: "var(--m-forest)", flexShrink: 0, marginTop: 1 }} />
          <span className="t-small" style={{ color: "var(--m-ink)" }}>
            &quot;Order via meshi&quot; lets the agent build your Instamart cart and confirm before placing — COD, ₹1000 cap. Other platforms open their own app with your list pre-searched.
          </span>
        </div>
      </div>
    </div>
  );
}
