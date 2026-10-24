"use client";

/**
 * "Cook with a soundtrack" — a nudge to put music on while cooking, linking to
 * a Spotify playlist search picked from the dish (lib/deeplinks).
 *
 * A plain outbound link by decision (2026-10-24): Spotify's MCP is a pilot for
 * approved clients only, and its Web API keeps new apps to a handful of named
 * test users, so no account connection is offered. Spotify is named in text
 * only — no Spotify logo, so none of their brand assets are used.
 *
 * Behind the partner_spotify flag (lib/partners.ts); renders nothing while it
 * is off or still loading. Uses only meshi-b classes (.card, .chip, .t-*),
 * which both root layouts load.
 */

import { ExternalLink, Music } from "lucide-react";
import { usePartners } from "@/lib/feature-flags";
import { buildSpotifyCookingLink, cookingMood } from "@/lib/deeplinks";

export function SpotifyNudge({ dishName }: { dishName: string }) {
  const { spotify } = usePartners();
  if (!spotify) return null;
  const mood = cookingMood(dishName);
  return (
    <div className="card tint-lav hstack" style={{ boxShadow: "none", padding: 14, gap: 12 }}>
      <span
        className="hstack"
        style={{ width: 40, height: 40, borderRadius: 12, background: "var(--m-card)", justifyContent: "center", flex: "none", color: "var(--text-plum)" }}
        aria-hidden
      >
        <Music width={20} height={20} />
      </span>
      <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
        <span className="t-h2" style={{ fontSize: 14 }}>Cook with a soundtrack</span>
        <span className="t-cap">{mood.label} playlists on Spotify</span>
      </div>
      <a
        className="chip"
        href={buildSpotifyCookingLink(dishName)}
        target="_blank"
        rel="noopener noreferrer"
        style={{ flex: "none", textDecoration: "none" }}
        aria-label={`Open ${mood.label} playlists on Spotify (opens in a new tab)`}
      >
        Open Spotify <ExternalLink width={13} height={13} aria-hidden />
      </a>
    </div>
  );
}
