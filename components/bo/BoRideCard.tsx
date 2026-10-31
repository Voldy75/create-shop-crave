"use client";

/**
 * Where Bo can take the user — rendered from the output of its
 * `meshi_ride__show_ride` call (lib/bo/ride-tools.ts). The buttons only open
 * Uber or Ola with the destination filled in; the user confirms the ride and
 * pays there. Ola's link needs both ends as coordinates, so it shows only when
 * we have them, the same rule as the web dine-out route screen.
 *
 * Shared by both root layouts: meshi-b classes and tokens only (the brand-filled
 * .mp-uber chips exist only in the web tree).
 */

import { Car, ExternalLink, MapPin } from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import { buildOlaDeepLink, buildUberDeepLink } from "@/lib/deeplinks";
import { isNative, openOutside } from "@/lib/native-bridge";
import type { RideDestination } from "@/lib/bo/ride-tools";

/** The tool output's destination, or null if there is none to show. */
export function rideFromOutput(output: unknown): RideDestination | null {
  const d = (output as { destination?: Record<string, unknown> } | null | undefined)?.destination;
  if (!d || typeof d.name !== "string" || !d.name) return null;
  const pinned = typeof d.lat === "number" && typeof d.lng === "number";
  return {
    name: d.name,
    ...(typeof d.address === "string" && d.address ? { address: d.address } : {}),
    ...(pinned ? { lat: d.lat as number, lng: d.lng as number } : {}),
  };
}

function RideLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={{ textDecoration: "none" }}
      onClick={(e) => {
        // The app's WebView ignores target="_blank".
        if (!isNative()) return;
        e.preventDefault();
        void openOutside(href);
      }}
    >
      {children}
    </a>
  );
}

export function BoRideCard({ ride }: { ride: RideDestination }) {
  const { location } = useUser();
  const drop = ride.lat !== undefined && ride.lng !== undefined ? { lat: ride.lat, lng: ride.lng } : null;

  return (
    <section className="card vstack" aria-label={`Ride to ${ride.name}`} style={{ padding: "16px 18px", gap: 12, maxWidth: 560 }}>
      <div className="hstack" style={{ gap: 8 }}>
        <Car width={16} height={16} aria-hidden style={{ color: "var(--figure-accent)", flex: "none" }} />
        <span className="t-micro">Ride there</span>
      </div>
      <div className="vstack" style={{ gap: 4 }}>
        <h3 className="t-h2" style={{ margin: 0 }}>{ride.name}</h3>
        {ride.address && (
          <p className="hstack t-body-soft" style={{ margin: 0, fontSize: 14, gap: 6, alignItems: "flex-start" }}>
            <MapPin width={14} height={14} aria-hidden style={{ flex: "none", marginTop: 3 }} /> {ride.address}
          </p>
        )}
      </div>
      <div className="hstack" style={{ gap: 8, flexWrap: "wrap" }}>
        <RideLink className="pill-primary pill-sm" href={buildUberDeepLink(location, drop, ride.name, ride.address ?? ride.name)}>
          <ExternalLink width={15} height={15} aria-hidden /> Open in Uber
        </RideLink>
        {drop && location && (
          <RideLink className="pill-secondary pill-sm" href={buildOlaDeepLink(location, drop, ride.name)}>
            <ExternalLink width={15} height={15} aria-hidden /> Open in Ola
          </RideLink>
        )}
      </div>
      <p className="t-cap" style={{ margin: 0 }}>You confirm the ride and pay in the app. Bo doesn’t book it.</p>
    </section>
  );
}
