"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { CCButton } from "@/components/cc/button";
import { CCCard } from "@/components/cc/card";
import { ProviderHealth, type ProvidersBlock } from "./provider-health";

const PROVIDER_OPTIONS = ["razorpay", "stripe", "apple", "google"] as const;

interface ConfigRow {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

interface RateLimitDefault {
  chat_daily: number;
  photo_daily: number;
}

function findConfig(rows: ConfigRow[], key: string): ConfigRow | undefined {
  return rows.find((r) => r.key === key);
}

export default function ConfigPage() {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [providers, setProviders] = useState<ProvidersBlock | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [chatDaily, setChatDaily] = useState("");
  const [photoDaily, setPhotoDaily] = useState("");
  const [savingLimits, setSavingLimits] = useState(false);
  const [limitsError, setLimitsError] = useState<string | null>(null);

  const [platformProviders, setPlatformProviders] = useState<Record<"web" | "ios" | "android", string[]>>({
    web: [],
    ios: [],
    android: [],
  });
  const [savingPlatform, setSavingPlatform] = useState<"web" | "ios" | "android" | null>(null);
  const [platformError, setPlatformError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/config");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Failed to load config");
        return;
      }
      const configRows: ConfigRow[] = data.config ?? [];
      setRows(configRows);
      setProviders(data.providers ?? null);

      const rateLimit = findConfig(configRows, "rate_limits.default")?.value as RateLimitDefault | undefined;
      setChatDaily(rateLimit?.chat_daily !== undefined ? String(rateLimit.chat_daily) : "");
      setPhotoDaily(rateLimit?.photo_daily !== undefined ? String(rateLimit.photo_daily) : "");

      setPlatformProviders({
        web: (findConfig(configRows, "payments.providers.web")?.value as string[]) ?? [],
        ios: (findConfig(configRows, "payments.providers.ios")?.value as string[]) ?? [],
        android: (findConfig(configRows, "payments.providers.android")?.value as string[]) ?? [],
      });
    } catch {
      setError("Failed to load config. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaveLimits = async () => {
    const chat = Number.parseInt(chatDaily, 10);
    const photo = Number.parseInt(photoDaily, 10);
    if (!Number.isFinite(chat) || chat < 0 || !Number.isFinite(photo) || photo < 0) {
      setLimitsError("Both limits must be non-negative numbers");
      return;
    }
    setSavingLimits(true);
    setLimitsError(null);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "rate_limits.default", value: { chat_daily: chat, photo_daily: photo } }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setLimitsError(data?.error ?? "Failed to save");
        return;
      }
      setRows((prev) => {
        const next = prev.filter((r) => r.key !== "rate_limits.default");
        return [...next, data.config];
      });
    } finally {
      setSavingLimits(false);
    }
  };

  const toggleProvider = (platform: "web" | "ios" | "android", provider: string) => {
    setPlatformProviders((prev) => {
      const list = prev[platform];
      const next = list.includes(provider) ? list.filter((p) => p !== provider) : [...list, provider];
      return { ...prev, [platform]: next };
    });
  };

  const handleSavePlatform = async (platform: "web" | "ios" | "android") => {
    setSavingPlatform(platform);
    setPlatformError(null);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: `payments.providers.${platform}`, value: platformProviders[platform] }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setPlatformError(data?.error ?? "Failed to save");
        return;
      }
      setRows((prev) => {
        const next = prev.filter((r) => r.key !== `payments.providers.${platform}`);
        return [...next, data.config];
      });
    } finally {
      setSavingPlatform(null);
    }
  };

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--m-ink-soft)" }} />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="font-bold text-lg" style={{ color: "var(--m-ink)", letterSpacing: "-0.02em" }}>
          Config
        </h1>
      </div>

      {error && (
        <div
          className="rounded-xl p-4 text-sm"
          style={{
            background: "color-mix(in srgb, var(--m-red) 10%, transparent)",
            color: "var(--m-red)",
            border: "1.5px solid color-mix(in srgb, var(--m-red) 22%, transparent)",
          }}
        >
          {error}
        </div>
      )}

      {/* Rate limits */}
      <CCCard className="p-5 space-y-3">
        <h2 className="font-bold" style={{ color: "var(--m-ink)" }}>Default rate limits</h2>
        <p className="text-xs" style={{ color: "var(--m-ink-soft)" }}>
          Applied to users with no plan. Changes take up to ~60s to propagate across warm serverless instances
          (the config cache TTL).
        </p>
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--m-ink-soft)" }}>
            Chat daily
            <input
              value={chatDaily}
              onChange={(e) => setChatDaily(e.target.value)}
              inputMode="numeric"
              className="px-3 py-2 text-sm rounded-lg"
              style={{ background: "var(--m-cream-2)", border: "1px solid var(--m-ink-faint)", color: "var(--m-ink)" }}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--m-ink-soft)" }}>
            Photo daily
            <input
              value={photoDaily}
              onChange={(e) => setPhotoDaily(e.target.value)}
              inputMode="numeric"
              className="px-3 py-2 text-sm rounded-lg"
              style={{ background: "var(--m-cream-2)", border: "1px solid var(--m-ink-faint)", color: "var(--m-ink)" }}
            />
          </label>
        </div>
        {limitsError && <p className="text-xs" style={{ color: "var(--m-red)" }}>{limitsError}</p>}
        <CCButton size="sm" onClick={handleSaveLimits} disabled={savingLimits}>
          {savingLimits && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save limits
        </CCButton>
      </CCCard>

      {/* Payment providers per platform */}
      <CCCard className="p-5 space-y-4">
        <h2 className="font-bold" style={{ color: "var(--m-ink)" }}>Checkout providers by platform</h2>
        {platformError && <p className="text-xs" style={{ color: "var(--m-red)" }}>{platformError}</p>}
        {(["web", "ios", "android"] as const).map((platform) => (
          <div key={platform} className="space-y-2">
            <p className="text-label" style={{ color: "var(--m-ink-soft)" }}>{platform}</p>
            <div className="flex flex-wrap gap-3">
              {PROVIDER_OPTIONS.map((provider) => (
                <label
                  key={provider}
                  className="flex items-center gap-1.5 text-sm"
                  style={{ color: "var(--m-ink-soft)" }}
                >
                  <input
                    type="checkbox"
                    checked={platformProviders[platform].includes(provider)}
                    onChange={() => toggleProvider(platform, provider)}
                  />
                  {provider}
                </label>
              ))}
            </div>
            <CCButton
              size="sm"
              variant="secondary"
              onClick={() => handleSavePlatform(platform)}
              disabled={savingPlatform === platform}
            >
              {savingPlatform === platform && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save {platform}
            </CCButton>
          </div>
        ))}
      </CCCard>

      {/* Provider health (read-only) */}
      <CCCard className="p-5 space-y-3">
        <h2 className="font-bold" style={{ color: "var(--m-ink)" }}>Provider health</h2>
        {providers && <ProviderHealth providers={providers} />}
      </CCCard>
    </main>
  );
}
