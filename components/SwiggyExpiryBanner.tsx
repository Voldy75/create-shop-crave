"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, X } from "lucide-react";
import { getSwiggyStatus, type SwiggyStatus } from "@/lib/swiggy-client";

/**
 * Thin banner shown in the chat header when the user's Swiggy token is
 * about to expire (<24h) or already expired. Dismissible per-session.
 *
 * Mounted only in /chat agent mode — elsewhere the Settings page surfaces
 * the same info more verbosely.
 */
export function SwiggyExpiryBanner() {
  const [status, setStatus] = useState<SwiggyStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSwiggyStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (dismissed) return null;
  if (!status) return null;

  // Not configured: a different (and louder) message from "expiring".
  if (!status.configured) {
    return (
      <BannerShell
        tone="info"
        onDismiss={() => setDismissed(true)}
        body={
          <>
            Swiggy agent isn&apos;t configured yet —{" "}
            <a
              href="https://mcp.swiggy.com/builders/access/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--m-forest)", textDecoration: "underline" }}
            >
              admin needs credentials
            </a>
            . You can still ask for ideas; ordering will fail.
          </>
        }
      />
    );
  }

  if (status.expired) {
    return (
      <BannerShell
        tone="warn"
        onDismiss={() => setDismissed(true)}
        body={
          <>
            Your Swiggy session expired (v1 has no refresh tokens).{" "}
            <Link href="/settings/notifications" style={{ color: "var(--m-forest)", textDecoration: "underline" }}>
              Reconnect
            </Link>{" "}
            to keep ordering.
          </>
        }
      />
    );
  }

  if (status.expiringWithin24h) {
    return (
      <BannerShell
        tone="warn"
        onDismiss={() => setDismissed(true)}
        body={
          <>
            Swiggy session expires soon.{" "}
            <Link href="/settings/notifications" style={{ color: "var(--m-forest)", textDecoration: "underline" }}>
              Reconnect
            </Link>{" "}
            now to avoid mid-order dropouts.
          </>
        }
      />
    );
  }

  if (!status.connected) {
    return (
      <BannerShell
        tone="info"
        onDismiss={() => setDismissed(true)}
        body={
          <>
            You aren&apos;t connected to Swiggy yet —{" "}
            <Link href="/settings/notifications" style={{ color: "var(--m-forest)", textDecoration: "underline" }}>
              connect in Settings
            </Link>{" "}
            to let the agent order on your behalf.
          </>
        }
      />
    );
  }

  return null;
}

function BannerShell({ tone, body, onDismiss }: { tone: "info" | "warn"; body: React.ReactNode; onDismiss: () => void }) {
  const color = tone === "warn" ? "#ff9f0a" : "#0a84ff";
  const bg = tone === "warn" ? "rgba(255,159,10,0.08)" : "rgba(10,132,255,0.06)";
  const border = tone === "warn" ? "rgba(255,159,10,0.25)" : "rgba(10,132,255,0.20)";
  return (
    <div
      className="flex items-center gap-2 px-4 py-2"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: "10px",
        fontSize: "12px",
        color: "var(--m-ink-soft)",
      }}
    >
      <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color }} />
      <div style={{ flex: 1, lineHeight: 1.4 }}>{body}</div>
      <button
        onClick={onDismiss}
        className="p-1 transition-opacity hover:opacity-70"
        style={{ color: "var(--m-ink-soft)" }}
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
