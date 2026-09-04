"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Utensils, ShoppingCart, ExternalLink, Loader2, AlertCircle, Check } from "lucide-react";
import { getSwiggyStatus, startSwiggyAuth, disconnectSwiggy, type SwiggyStatus } from "@/lib/swiggy-client";
import { useFeatureFlags } from "@/lib/feature-flags";
import { BoBowl } from "@/components/mascots";

/**
 * Connections — artboard 7e, in the MOBILE tree.
 *
 * This was the LAST cross-root-layout jump. `/m/profile`'s Swiggy chip pushed
 * at `/settings?tab=connections` — a full document load into the WEB shell,
 * sidebar and all — because account linking had no /m screen. This is that
 * screen. Same swiggy-client, same feature flags web uses; the difference is
 * it stays inside /m and wears meshi Kitchef.
 *
 * WHAT IS REAL vs NOT, and it matters:
 *  - Swiggy status/connect/disconnect ARE the real flow (lib/swiggy-client →
 *    /api/swiggy/*). BUT the OAuth itself is Dead End 1 — Swiggy's MCP gateway
 *    rejects our web origin — so "Connect" starts a round trip that can fail
 *    upstream for reasons the user cannot fix. The copy does not promise it
 *    will succeed.
 *  - Instacart / Zomato are DISABLED placeholders gated on their feature flags,
 *    exactly as web's ConnectionsSection shows them. No public MCP endpoint is
 *    known for either, so they read "Coming soon" until an admin flips the flag.
 *
 * ONE PRE-EXISTING QUIRK, documented not fixed here: the OAuth callback
 * (app/api/swiggy/auth/callback) redirects to `/settings/notifications` — a
 * hardcoded WEB path — so a completed connect lands back on web settings, not
 * here. Changing that server redirect is out of scope for a UI screen, and the
 * flow is blocked upstream regardless.
 */

interface Provider {
  id: string;
  flagId: string;
  name: string;
  description: string;
  icon: typeof Utensils;
}

const EXTRA_PROVIDERS: Provider[] = [
  { id: "instacart", flagId: "mcp_instacart", name: "Instacart", description: "Shop groceries from local stores, delivered in hours.", icon: ShoppingCart },
  { id: "zomato", flagId: "mcp_zomato", name: "Zomato", description: "Discover restaurants, order food, and book tables.", icon: Utensils },
];

export default function MobileConnectionsPage() {
  const router = useRouter();
  const { isEnabled, loading: flagsLoading } = useFeatureFlags();

  const [swiggy, setSwiggy] = useState<SwiggyStatus | null>(null);
  const [swiggyLoaded, setSwiggyLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Reused by the disconnect handler (an event handler, so no effect-lint
  // concern there). The MOUNT read is done inline below instead of calling this
  // synchronously in the effect — setState inside a `.then()` continuation is
  // what the linter accepts, matching /m/settings/notifications.
  const refresh = async () => {
    const status = await getSwiggyStatus();
    setSwiggy(status);
    setSwiggyLoaded(true);
  };

  useEffect(() => {
    let cancelled = false;
    getSwiggyStatus().then((status) => {
      if (cancelled) return;
      setSwiggy(status);
      setSwiggyLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  const connect = async () => {
    setBusy(true);
    setNote(null);
    const result = await startSwiggyAuth();
    // On success the browser has already navigated to Swiggy; we only reach the
    // next line on failure.
    if (!result.ok) {
      setBusy(false);
      setNote("Couldn't start the Swiggy connection. It may not be available for this app yet.");
    }
  };

  const disconnect = async () => {
    setBusy(true);
    await disconnectSwiggy();
    await refresh();
    setBusy(false);
    setNote("Swiggy disconnected.");
  };

  const shell: React.CSSProperties = {
    minHeight: "100dvh",
    background: "var(--m-cream)",
    padding: "20px 18px calc(env(safe-area-inset-bottom, 8px) + 28px)",
    gap: 14,
  };

  return (
    <div className="vstack" style={shell}>
      <div className="hstack">
        <button className="icon-btn" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft width={20} height={20} />
        </button>
        <span className="t-h1 grow" style={{ marginLeft: 10 }}>Connections</span>
      </div>

      <div className="vstack" style={{ gap: 4 }}>
        <span className="t-d2">Link your<br />ordering apps</span>
        <span className="t-body-soft">
          Connect a service and Bo can search menus, build carts and place orders from chat.
        </span>
      </div>

      {note && (
        <div className="toast tint-green" style={{ boxShadow: "none" }}>
          <BoBowl width={28} height={28} style={{ flex: "none" }} />
          {note}
        </div>
      )}

      {/* ── Swiggy — the real, load-bearing one ── */}
      {!swiggyLoaded ? (
        <div className="card" style={{ height: 96, opacity: 0.6 }} aria-label="Loading Swiggy status" />
      ) : (
        <div className="card vstack" style={{ padding: 16, gap: 12 }}>
          <div className="hstack" style={{ gap: 12 }}>
            <span
              className="icon-btn"
              style={{ boxShadow: "none", flex: "none", background: "var(--m-tint-peach)", color: "var(--m-burnt)" }}
              aria-hidden
            >
              <Utensils width={20} height={20} />
            </span>
            <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
              <span className="t-h2">Swiggy agent</span>
              <span className="t-cap">Order food, groceries and book tables via chat.</span>
            </div>
            <ConnPill connected={!!swiggy?.connected} />
          </div>

          {swiggy?.connected ? (
            <button className="chip" onClick={disconnect} disabled={busy} style={{ alignSelf: "flex-start", color: "var(--m-burnt)" }}>
              {busy ? <Loader2 width={15} height={15} className="animate-spin" /> : <AlertCircle width={15} height={15} />}
              Disconnect
            </button>
          ) : (
            <button className="pill-primary pill-sm" onClick={connect} disabled={busy} style={{ alignSelf: "flex-start" }}>
              {busy ? <Loader2 width={15} height={15} className="animate-spin" /> : <ExternalLink width={15} height={15} />}
              Connect Swiggy
            </button>
          )}

          {/* The expiry state web surfaces too — real data from the token. */}
          {swiggy?.connected && swiggy.expiringWithin24h && (
            <span className="t-cap" style={{ color: "var(--m-burnt)" }}>
              This connection expires soon — reconnect to keep ordering.
            </span>
          )}
        </div>
      )}

      {/* ── Placeholders, flag-gated exactly like web ── */}
      {EXTRA_PROVIDERS.map((p) => {
        const enabled = !flagsLoading && isEnabled(p.flagId);
        const Icon = p.icon;
        return (
          <div key={p.id} className="card vstack" style={{ padding: 16, gap: 12, opacity: enabled ? 1 : 0.55 }}>
            <div className="hstack" style={{ gap: 12 }}>
              <span
                className="icon-btn"
                style={{ boxShadow: "none", flex: "none", background: "var(--m-cream-2)", color: "var(--m-ink-soft)" }}
                aria-hidden
              >
                <Icon width={20} height={20} />
              </span>
              <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
                <span className="t-h2">{p.name}</span>
                <span className="t-cap">{p.description}</span>
              </div>
              {enabled ? <ConnPill connected={false} /> : <SoonPill />}
            </div>
            {enabled ? (
              <button className="chip" style={{ alignSelf: "flex-start" }}>
                <ExternalLink width={15} height={15} /> Connect {p.name}
              </button>
            ) : (
              <span className="t-cap" style={{ fontStyle: "italic" }}>
                Available once an admin enables it.
              </span>
            )}
          </div>
        );
      })}

      <span className="t-cap" style={{ marginTop: 4 }}>
        Connecting hands Bo a scoped token for that service. You can disconnect any time,
        and nothing is charged without your confirmation in chat.
      </span>
    </div>
  );
}

/** Connected / Not connected — token-driven so it tracks dark mode. */
function ConnPill({ connected }: { connected: boolean }) {
  return (
    <span
      className="t-cap"
      style={{
        flex: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 9px",
        borderRadius: 999,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        fontWeight: 700,
        fontSize: 10,
        background: connected ? "var(--m-tint-green)" : "var(--m-cream-2)",
        color: connected ? "var(--m-forest)" : "var(--m-ink-soft)",
      }}
    >
      {connected && <Check width={11} height={11} />}
      {connected ? "Connected" : "Not connected"}
    </span>
  );
}

function SoonPill() {
  return (
    <span
      className="t-cap"
      style={{
        flex: "none",
        padding: "3px 9px",
        borderRadius: 999,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        fontWeight: 700,
        fontSize: 10,
        background: "var(--m-cream-2)",
        color: "var(--m-ink-soft)",
      }}
    >
      Coming soon
    </span>
  );
}
