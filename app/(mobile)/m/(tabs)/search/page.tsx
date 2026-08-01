"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { foodImage } from "@/lib/food-images";
import { Broccoli, Chili, Mushroom, Lemon } from "@/components/mascots";

/**
 * Discover — built to the Flow 2 "Discover" artboard.
 *
 * A featured duotone hero curated by Bo, then a 2×2 grid of mascot-fronted
 * collections. Each collection is a mood with a character attached — the same
 * idea as the cravings row on Home, where a mascot communicates a mood far
 * better than a photo of one finished dish.
 *
 * Route stays /m/search (it is the Discover tab) so existing links keep working.
 * Everything still hands the query to chat.
 */

const FEATURED = {
  tag: "Featured week",
  title: ["Broth season", "is upon us"],
  sub: "12 recipes · curated by Bo",
  query: "Show me warming broths and soups",
  image: "ramen",
};

const COLLECTIONS = [
  { name: "Green machine", count: "18 recipes", tint: "tint-green", Mascot: Broccoli, q: "Green, veg-forward recipes" },
  { name: "Hurts so good", count: "11 recipes", tint: "tint-peach", Mascot: Chili, q: "Seriously spicy recipes" },
  { name: "Umami bombs", count: "14 recipes", tint: "tint-lav", Mascot: Mushroom, q: "Deeply savoury umami-rich recipes" },
  { name: "10-min wonders", count: "22 recipes", tint: "tint-cream", Mascot: Lemon, q: "Recipes I can cook in 10 minutes" },
];

export default function MobileDiscover() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const go = (query: string) => {
    if (!query.trim()) return;
    router.push(`/m/chat?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="col" style={{ height: "100%", background: "var(--m-cream)" }}>
      <div
        className="scroll vstack"
        style={{ flex: 1, padding: "calc(env(safe-area-inset-top, 12px) + 10px) 20px 0" }}
      >
        <span className="t-d2">Discover</span>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            go(q);
          }}
        >
          <label className="input" style={{ width: "100%" }}>
            <SearchIcon width={20} height={20} style={{ color: "var(--m-ink-soft)" }} />
            <input
              className="grow"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Dishes, restaurants, moods…"
              style={{ border: "none", background: "transparent", outline: "none", minWidth: 0 }}
              aria-label="Search dishes, restaurants and moods"
            />
          </label>
        </form>

        {/* Featured — Bo's pick of the week */}
        <button
          className="duo duo-plum"
          style={{ height: 190, flex: "none", border: "none", padding: 0, width: "100%" }}
          onClick={() => go(FEATURED.query)}
        >
          <div
            className="imgfill"
            style={{ position: "absolute", inset: 0, backgroundImage: `url('${foodImage(FEATURED.image) ?? ""}')` }}
          />
          <div
            className="duo-body"
            style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 16, gap: 4 }}
          >
            <span className="chip chip-tag" style={{ alignSelf: "flex-start", background: "var(--m-lime)" }}>
              {FEATURED.tag}
            </span>
            <span style={{ font: "800 24px/1 var(--m-font-display)", color: "var(--m-on-deep)", textAlign: "left" }}>
              {FEATURED.title[0]}
              <br />
              {FEATURED.title[1]}
            </span>
            <span className="t-cap" style={{ color: "rgba(253,248,231,.85)", textAlign: "left" }}>
              {FEATURED.sub}
            </span>
          </div>
        </button>

        <span className="t-h1">Collections</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {COLLECTIONS.map(({ name, count, tint, Mascot, q: cq }) => (
            <button
              key={name}
              className={`card ${tint}`}
              style={{
                boxShadow: "none", padding: 14, display: "flex", flexDirection: "column",
                gap: 6, border: "none", textAlign: "left", alignItems: "flex-start",
              }}
              onClick={() => go(cq)}
            >
              <Mascot width={46} height={46} />
              <span className="t-h2">{name}</span>
              <span className="t-cap">{count}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
