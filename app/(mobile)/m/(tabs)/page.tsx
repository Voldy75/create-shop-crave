"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search as SearchIcon, Mic, Bell, Flame } from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import { getMealLogs } from "@/lib/storage";
import { loggingStreak } from "@/lib/nutrition";
import { foodImage } from "@/lib/food-images";
import { CarrotRating } from "@/components/mobile/CarrotRating";
import { NotificationPrompt } from "@/components/mobile/NotificationPrompt";
import { Pea, Chili, Mushroom, Broccoli } from "@/components/mascots";

/**
 * meshi Home — built to the Flow 2 "Home" artboard.
 *
 * Structure comes from the design, not from the previous screen: a greeting +
 * streak + bell header, a prominent search field, an "Order again?" peach card,
 * a 4-up MASCOT grid for cravings (the old version used photos here — the
 * design deliberately uses characters, since a photo of a finished dish is the
 * wrong signal for a mood), and two side-by-side duotone picks with a time
 * badge and a carrot rating.
 */

/** Cravings are moods, fronted by a mascot each — not dish photography. */
const CRAVINGS = [
  { label: "Comfy", tint: "tint-green", Mascot: Pea, q: "Something comforting" },
  { label: "Spicy", tint: "tint-peach", Mascot: Chili, q: "Something spicy" },
  { label: "Cozy", tint: "tint-lav", Mascot: Mushroom, q: "Something cozy and slow" },
  { label: "Fresh", tint: "tint-green", Mascot: Broccoli, q: "Something fresh and light" },
];

const PICKS = [
  { name: "Green goddess bowl", mins: 25, rating: 4, duo: "duo-forest", badge: "badge-brown" },
  { name: "Nonna's red pizza", mins: 40, rating: 5, duo: "duo-plum", badge: "badge-burnt" },
];

function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function MeshiHome() {
  const router = useRouter();
  const { userName, hydrated } = useUser();
  const [hello, setHello] = useState("Hello");
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setHello(greeting(new Date()));
    setStreak(loggingStreak(getMealLogs()));
  }, []);

  const firstName = hydrated && userName ? userName.split(" ")[0] : "";

  return (
    <div className="col" style={{ height: "100%", background: "var(--m-cream)" }}>
      <div className="scroll" style={{ flex: 1 }}>
        {/* Header — greeting, streak, notifications */}
        <div
          className="hstack"
          style={{ padding: "calc(env(safe-area-inset-top, 12px) + 10px) 20px 4px", gap: 10 }}
        >
          <div className="vstack grow" style={{ gap: 0 }}>
            <span className="t-cap">
              {hello}
              {firstName ? `, ${firstName}` : ""}
            </span>
            <span className="t-h1" style={{ fontSize: 22 }}>
              What&rsquo;s cooking?
            </span>
          </div>

          {streak > 0 && (
            <Link href="/m/plan/streak" className="streak-chip" aria-label={`${streak} day logging streak`}>
              <Flame width={18} height={18} />
              {streak}
            </Link>
          )}

          <Link href="/m/inbox" className="icon-btn" style={{ position: "relative" }} aria-label="Inbox">
            <Bell width={21} height={21} />
            <i
              style={{
                position: "absolute", top: 9, right: 10, width: 8, height: 8,
                borderRadius: 9, background: "var(--m-red)",
              }}
            />
          </Link>
        </div>

        {/* Search — the design leads with this rather than a brief card */}
        <div style={{ padding: "12px 20px 0" }}>
          <button
            className="input"
            style={{ width: "100%", border: "none", textAlign: "left" }}
            onClick={() => router.push("/m/search")}
          >
            <SearchIcon width={20} height={20} style={{ color: "var(--m-ink-soft)" }} />
            <span className="grow" style={{ color: "var(--m-ink-soft)" }}>
              Ramen? Tacos? Feelings?
            </span>
            <Mic width={19} height={19} style={{ color: "var(--m-forest)" }} />
          </button>
        </div>

        <div className="vstack" style={{ padding: "16px 20px 0" }}>
          {/* Order again — hands the agent the user's go-to Instamart items */}
          <button
            className="card tint-peach"
            style={{
              boxShadow: "none", padding: "14px 16px", display: "flex",
              alignItems: "center", gap: 14, width: "100%", textAlign: "left", border: "none",
            }}
            onClick={() =>
              router.push(
                "/m/chat?agent=1&q=" +
                  encodeURIComponent(
                    "Reorder my usual groceries from Swiggy Instamart using my go-to items. Confirm the cart before placing.",
                  ),
              )
            }
          >
            <div
              className="imgfill"
              style={{
                width: 64, height: 64, borderRadius: 14, flex: "none",
                backgroundImage: `url('${foodImage("ramen") ?? ""}')`,
              }}
            />
            <div className="vstack grow" style={{ gap: 2, minWidth: 0 }}>
              <span className="t-micro" style={{ color: "var(--m-burnt)" }}>Order again?</span>
              <span className="t-h2">Your Instamart go-tos</span>
              <span className="t-cap">Bo will confirm the cart first</span>
            </div>
            <span className="pill-lime pill-sm">Reorder</span>
          </button>

          {/* Cravings — mascots, one per mood */}
          <div className="hstack" style={{ justifyContent: "space-between", marginTop: 4 }}>
            <span className="t-h1">Craving something?</span>
            <Link href="/m/search" className="t-cap" style={{ color: "var(--figure-accent)" }}>
              See all
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {CRAVINGS.map(({ label, tint, Mascot, q }) => (
              <button
                key={label}
                className={`mascot-tile ${tint}`}
                style={{ padding: "10px 4px", border: "none" }}
                onClick={() => router.push("/m/chat?q=" + encodeURIComponent(q))}
              >
                <Mascot width={40} height={40} />
                <span className="t-cap" style={{ color: "var(--m-ink)" }}>{label}</span>
              </button>
            ))}
          </div>

          {/* Editor's picks — duotone photo cards with time badge + carrots */}
          <div className="hstack" style={{ justifyContent: "space-between", marginTop: 4 }}>
            <span className="t-h1">Editor&rsquo;s picks</span>
            <Link href="/m/search" className="t-cap" style={{ color: "var(--figure-accent)" }}>
              See all
            </Link>
          </div>
          <div className="hstack" style={{ alignItems: "stretch", gap: 12 }}>
            {PICKS.map((p) => (
              <button
                key={p.name}
                className={`duo ${p.duo} grow`}
                style={{ height: 210, border: "none", padding: 0 }}
                onClick={() => router.push("/m/chat?q=" + encodeURIComponent(p.name))}
              >
                <div
                  className="imgfill"
                  style={{ position: "absolute", inset: 0, backgroundImage: `url('${foodImage(p.name) ?? ""}')` }}
                />
                <div
                  className="duo-body"
                  style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 12 }}
                >
                  <span className={`badge ${p.badge}`} style={{ alignSelf: "flex-start" }}>
                    <b>{p.mins}</b>min
                  </span>
                  <div className="vstack" style={{ gap: 2 }}>
                    <span style={{ font: "800 19px/1.05 var(--m-font-display)", color: "var(--m-on-deep)", textAlign: "left" }}>
                      {p.name}
                    </span>
                    <CarrotRating value={p.rating} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
      <NotificationPrompt streak={streak} />
    </div>
  );
}
