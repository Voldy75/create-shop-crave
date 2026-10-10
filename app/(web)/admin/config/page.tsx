"use client";

/**
 * Admin → Config, built to w12f: runtime limits on the left, key health on
 * the right.
 *
 * Board → build: the board lists six limits (per-plan chats, a global AI cap,
 * per-minute rate, reply tokens, export TTL). None of those keys exist — the
 * config API accepts an allowlist, and the only limit the app reads from here
 * is rate_limits.default (chat + photo per day for users with no plan;
 * per-plan limits live on the Plans screen). Those two are what's editable.
 * limits.fail_mode is shown read-only because nothing reads it yet.
 * Checkout providers per platform is kept from the old screen (not drawn):
 * it is what /api/billing/options offers each platform.
 */

import { useCallback, useEffect, useState } from "react";
import { AdminError, AdminLoading, AdminTop } from "../admin-shell";
import { ProviderHealth, healthChecks, type ProvidersBlock } from "./provider-health";

type PlatformKey = "web" | "ios" | "android";
const PLATFORMS: PlatformKey[] = ["web", "ios", "android"];
const PROVIDER_OPTIONS = ["razorpay", "stripe", "apple", "google"] as const;
const PROVIDER_NAME: Record<string, string> = { razorpay: "Razorpay", stripe: "Stripe", apple: "App Store", google: "Play" };
const PLATFORM_NAME: Record<PlatformKey, string> = { web: "Web", ios: "iOS", android: "Android" };

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

const find = (rows: ConfigRow[], key: string) => rows.find((r) => r.key === key);

export default function ConfigPage() {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [providers, setProviders] = useState<ProvidersBlock | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [chat, setChat] = useState("");
  const [photo, setPhoto] = useState("");
  const [savingLimits, setSavingLimits] = useState(false);
  const [limitsMsg, setLimitsMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [platformProviders, setPlatformProviders] = useState<Record<PlatformKey, string[]>>({ web: [], ios: [], android: [] });
  const [savingPlatform, setSavingPlatform] = useState<PlatformKey | null>(null);
  const [platformMsg, setPlatformMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const saved = (r: ConfigRow[]) => find(r, "rate_limits.default")?.value as RateLimitDefault | undefined;
  const savedProviders = (r: ConfigRow[], p: PlatformKey) => (find(r, `payments.providers.${p}`)?.value as string[] | undefined) ?? [];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/config");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Couldn’t load config.");
        return;
      }
      const r: ConfigRow[] = data.config ?? [];
      setRows(r);
      setProviders(data.providers ?? null);
      setCheckedAt(new Date());
      const rl = saved(r);
      setChat(rl?.chat_daily !== undefined ? String(rl.chat_daily) : "");
      setPhoto(rl?.photo_daily !== undefined ? String(rl.photo_daily) : "");
      setPlatformProviders({ web: savedProviders(r, "web"), ios: savedProviders(r, "ios"), android: savedProviders(r, "android") });
    } catch {
      setError("Couldn’t load config. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
     
    void load();
  }, [load]);

  const patch = async (key: string, value: unknown) => {
    const res = await fetch("/api/admin/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "Couldn’t save.");
    setRows((prev) => [...prev.filter((r) => r.key !== key), data.config]);
  };

  const rl = saved(rows);
  const chatDirty = chat !== (rl?.chat_daily !== undefined ? String(rl.chat_daily) : "");
  const photoDirty = photo !== (rl?.photo_daily !== undefined ? String(rl.photo_daily) : "");
  const unsaved = Number(chatDirty) + Number(photoDirty);

  const saveLimits = async () => {
    const c = Number.parseInt(chat, 10);
    const p = Number.parseInt(photo, 10);
    if (!Number.isFinite(c) || c < 0 || !Number.isFinite(p) || p < 0) {
      setLimitsMsg({ ok: false, text: "Both limits must be whole numbers, 0 or more." });
      return;
    }
    setSavingLimits(true);
    setLimitsMsg(null);
    try {
      await patch("rate_limits.default", { chat_daily: c, photo_daily: p });
      setLimitsMsg({ ok: true, text: "Saved. Takes up to a minute to reach every server." });
    } catch (e) {
      setLimitsMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn’t save." });
    } finally {
      setSavingLimits(false);
    }
  };

  const discardLimits = () => {
    setChat(rl?.chat_daily !== undefined ? String(rl.chat_daily) : "");
    setPhoto(rl?.photo_daily !== undefined ? String(rl.photo_daily) : "");
    setLimitsMsg(null);
  };

  const savePlatform = async (p: PlatformKey) => {
    setSavingPlatform(p);
    setPlatformMsg(null);
    try {
      await patch(`payments.providers.${p}`, platformProviders[p]);
      setPlatformMsg({ ok: true, text: `${PLATFORM_NAME[p]} checkout saved.` });
    } catch (e) {
      setPlatformMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn’t save." });
    } finally {
      setSavingPlatform(null);
    }
  };

  const checks = providers ? healthChecks(providers) : [];
  const failMode = find(rows, "limits.fail_mode")?.value;
  const limitRows: { label: string; key: string; value: string; set: (v: string) => void; dirty: boolean; was?: number }[] = [
    { label: "Bo chats per day", key: "chat_daily", value: chat, set: setChat, dirty: chatDirty, was: rl?.chat_daily },
    { label: "Photo scans per day", key: "photo_daily", value: photo, set: setPhoto, dirty: photoDirty, was: rl?.photo_daily },
  ];

  return (
    <>
      <AdminTop title="Config">
        {loading ? (
          <AdminLoading />
        ) : (
          checkedAt && (
            <span className="ad-cap">Checked {checkedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
          )
        )}
        <button type="button" className="ad-btn" onClick={() => void load()} disabled={loading || unsaved > 0} title={unsaved ? "Save or discard first" : undefined}>
          Re-check
        </button>
      </AdminTop>
      <div className="ad-body">
        {error && <AdminError>{error}</AdminError>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 330px), 1fr))", gap: 14, alignItems: "start" }}>
          <div className="vstack" style={{ gap: 14 }}>
            {/* Runtime limits */}
            <div className="ad-card" style={{ overflow: "hidden" }}>
              <div className="hstack" style={{ gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--m-ink-faint)" }}>
                <h2 className="ad-h grow">Runtime limits</h2>
                <span className="ad-cap">Applies without a deploy</span>
              </div>
              <table className="ad-tbl">
                <tbody>
                  {limitRows.map((r) => (
                    <tr key={r.key} style={r.dirty ? { background: "color-mix(in srgb, var(--m-cream-2) 50%, var(--m-card))" } : undefined}>
                      <td>
                        <div className="vstack" style={{ gap: 1 }}>
                          <label htmlFor={`cfg-${r.key}`} style={{ fontWeight: 700 }}>{r.label}</label>
                          <span className="ad-mono" style={{ fontSize: 11, color: "var(--m-ink-soft)" }}>rate_limits.default.{r.key}</span>
                        </div>
                      </td>
                      <td>
                        <div className="hstack" style={{ gap: 8 }}>
                          {loading ? (
                            <span className="ad-sk" style={{ width: 84, height: 30 }} />
                          ) : (
                            <input id={`cfg-${r.key}`} className={`ad-in${r.dirty ? " is-dirty" : ""}`} style={{ width: 84 }} value={r.value} onChange={(e) => r.set(e.target.value)} inputMode="numeric" />
                          )}
                          {r.dirty && r.was !== undefined && <span className="ad-cap">was {r.was}</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <div className="vstack" style={{ gap: 1 }}>
                        <span style={{ fontWeight: 700 }}>Usage-counter failure mode</span>
                        <span className="ad-mono" style={{ fontSize: 11, color: "var(--m-ink-soft)" }}>limits.fail_mode</span>
                      </div>
                    </td>
                    <td>
                      <div className="hstack" style={{ gap: 8, flexWrap: "wrap" }}>
                        <span className="ad-mono">{failMode === undefined ? "—" : JSON.stringify(failMode)}</span>
                        <span className="ad-cap">Read-only · not read by the app yet</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="ad-foot" style={{ flexWrap: "wrap" }}>
                <span className="ad-cap" role="status" style={limitsMsg && !limitsMsg.ok ? { color: "var(--text-red)" } : undefined}>
                  {limitsMsg?.text ?? (unsaved ? `${unsaved} unsaved change${unsaved === 1 ? "" : "s"}` : "For users with no plan. Plan limits are on Plans.")}
                </span>
                <div className="grow" />
                <button type="button" className="ad-btn" onClick={discardLimits} disabled={!unsaved || savingLimits}>
                  Discard
                </button>
                <button type="button" className="ad-btn ad-btn-p" onClick={() => void saveLimits()} disabled={!unsaved || savingLimits}>
                  {savingLimits ? "Saving…" : "Save limits"}
                </button>
              </div>
            </div>

            {/* Checkout providers */}
            <div className="ad-card" style={{ overflow: "hidden" }}>
              <div className="hstack" style={{ gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--m-ink-faint)" }}>
                <h2 className="ad-h grow">Checkout providers</h2>
                <span className="ad-cap">Offered at checkout, per platform</span>
              </div>
              <table className="ad-tbl">
                <tbody>
                  {PLATFORMS.map((p) => {
                    const dirty = platformProviders[p].slice().sort().join() !== savedProviders(rows, p).slice().sort().join();
                    return (
                      <tr key={p}>
                        <td style={{ fontWeight: 700, width: 90 }} id={`cfg-pl-${p}`}>{PLATFORM_NAME[p]}</td>
                        <td>
                          <div className="ad-seg" role="group" aria-labelledby={`cfg-pl-${p}`}>
                            {PROVIDER_OPTIONS.map((prov) => {
                              const on = platformProviders[p].includes(prov);
                              return (
                                <button
                                  key={prov}
                                  type="button"
                                  className={on ? "is-on" : ""}
                                  aria-pressed={on}
                                  onClick={() =>
                                    setPlatformProviders((prev) => ({
                                      ...prev,
                                      [p]: on ? prev[p].filter((x) => x !== prov) : [...prev[p], prov],
                                    }))
                                  }
                                >
                                  {PROVIDER_NAME[prov]}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td style={{ width: 90, textAlign: "right" }}>
                          <button type="button" className={`ad-btn${dirty ? " ad-btn-p" : ""}`} onClick={() => void savePlatform(p)} disabled={!dirty || savingPlatform === p}>
                            {savingPlatform === p ? "Saving…" : "Save"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="ad-foot">
                <span className="ad-cap" role="status" style={platformMsg && !platformMsg.ok ? { color: "var(--text-red)" } : undefined}>
                  {platformMsg?.text ?? "A provider is only offered once it also has a price on Plans."}
                </span>
              </div>
            </div>
          </div>

          {/* Health */}
          <div className="ad-card" style={{ overflow: "hidden" }}>
            <div className="hstack" style={{ gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--m-ink-faint)" }}>
              <h2 className="ad-h grow">Health</h2>
              {providers && <span className="ad-cap">{checks.filter((c) => c.present).length} of {checks.length} set</span>}
            </div>
            {providers ? (
              <ProviderHealth providers={providers} />
            ) : (
              <div className="vstack" style={{ gap: 10, padding: 14 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="ad-sk" style={{ width: "90%", height: 12 }} />
                ))}
              </div>
            )}
            <div className="ad-foot">
              <span className="ad-cap">Shows whether each key exists. Values are never read back. Set them in Vercel → Environment Variables.</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
