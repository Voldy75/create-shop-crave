"use client";

/**
 * One plan, built to w12c: limits on top, then a price per checkout provider
 * in its own currency, edited inline and saved together.
 *
 * Prices are typed in major units (749, 9.99) and stored in minor units —
 * the old editor made admins type 74900 by hand. Rows are keyed by
 * platform + provider, exactly as plan_prices is.
 */

import { useState } from "react";
import { Plus } from "lucide-react";
import type { AdminPlan, AdminPlanPrice } from "../users/types";

const PLATFORMS = ["web", "ios", "android"] as const;
const PROVIDERS = ["razorpay", "stripe", "apple", "google"] as const;
const INTERVALS = ["one_time", "month", "year"] as const;

const PROVIDER_NAME: Record<string, string> = { razorpay: "Razorpay", stripe: "Stripe", apple: "App Store", google: "Play" };
const INTERVAL_NAME: Record<string, string> = { one_time: "One-time · 31 days", month: "Monthly", year: "Yearly" };

const limitToInput = (v: number | null) => (v === null ? "" : String(v));
const toMajor = (minor: number) => (minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2));
const toMinor = (major: string): number | null => {
  const n = Number(major.trim());
  return major.trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};
const keyOf = (p: Pick<AdminPlanPrice, "platform" | "provider">) => `${p.platform}:${p.provider}`;

async function putPrice(planId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/admin/plans/${planId}/prices`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Couldn’t save the price.");
  return data.price as AdminPlanPrice;
}

export function PlanCard({ plan, onUpdated }: { plan: AdminPlan; onUpdated: (plan: AdminPlan) => void }) {
  const [name, setName] = useState(plan.name);
  const [chatLimit, setChatLimit] = useState(limitToInput(plan.chat_daily_limit));
  const [photoLimit, setPhotoLimit] = useState(limitToInput(plan.photo_daily_limit));
  const [isActive, setIsActive] = useState(plan.is_active);
  const [prices, setPrices] = useState<AdminPlanPrice[]>(plan.plan_prices ?? []);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingPrices, setSavingPrices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const planDirty =
    name !== plan.name ||
    chatLimit !== limitToInput(plan.chat_daily_limit) ||
    photoLimit !== limitToInput(plan.photo_daily_limit) ||
    isActive !== plan.is_active;
  const dirtyPrices = prices.filter((p) => drafts[keyOf(p)] !== undefined && toMinor(drafts[keyOf(p)]) !== p.amount_minor);

  const savePlan = async () => {
    const chat = chatLimit.trim() === "" ? null : Number.parseInt(chatLimit, 10);
    const photo = photoLimit.trim() === "" ? null : Number.parseInt(photoLimit, 10);
    if ((chat !== null && !Number.isFinite(chat)) || (photo !== null && !Number.isFinite(photo))) {
      setError("Limits must be whole numbers, or empty for unlimited.");
      return;
    }
    setSavingPlan(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Empty = unlimited -> explicit null, never 0 or a missing key.
        body: JSON.stringify({ id: plan.id, name, chat_daily_limit: chat, photo_daily_limit: photo, is_active: isActive }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Couldn’t save the plan.");
        return;
      }
      onUpdated({ ...data.plan, plan_prices: prices });
      setSaved("Plan saved.");
    } finally {
      setSavingPlan(false);
    }
  };

  const savePrices = async () => {
    for (const p of dirtyPrices) {
      if (toMinor(drafts[keyOf(p)]) === null) {
        setError(`${PROVIDER_NAME[p.provider] ?? p.provider} price must be a number.`);
        return;
      }
    }
    setSavingPrices(true);
    setError(null);
    setSaved(null);
    try {
      const results = await Promise.allSettled(
        dirtyPrices.map((p) =>
          putPrice(plan.id, {
            platform: p.platform,
            provider: p.provider,
            amount_minor: toMinor(drafts[keyOf(p)]),
            currency: p.currency,
            interval: p.interval,
            store_product_id: p.store_product_id,
            is_active: p.is_active,
          })
        )
      );
      const next = [...prices];
      const nextDrafts = { ...drafts };
      let failed = 0;
      results.forEach((r) => {
        if (r.status === "fulfilled") {
          const i = next.findIndex((p) => keyOf(p) === keyOf(r.value));
          if (i >= 0) next[i] = r.value;
          delete nextDrafts[keyOf(r.value)];
        } else failed++;
      });
      setPrices(next);
      setDrafts(nextDrafts);
      if (failed) setError(`${failed} price${failed === 1 ? "" : "s"} couldn’t be saved and kept the old value.`);
      else setSaved("Prices saved.");
    } finally {
      setSavingPrices(false);
    }
  };

  return (
    <div className="ad-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="hstack" style={{ gap: 8, flexWrap: "wrap" }}>
        <h2 className="ad-h">{plan.name}</h2>
        <span className="ad-mono" style={{ color: "var(--m-ink-soft)" }}>{plan.id}</span>
        <span className={`ad-pill ${plan.is_active ? "ad-ok" : "ad-mute"}`}>{plan.is_active ? "Active" : "Inactive"}</span>
      </div>

      {/* Limits */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <label className="vstack" style={{ gap: 5 }}>
          <span className="ad-lbl">Name</span>
          <input className="ad-in" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="vstack" style={{ gap: 5 }}>
          <span className="ad-lbl">Bo chats / day</span>
          <input className="ad-in" value={chatLimit} onChange={(e) => setChatLimit(e.target.value)} placeholder="Unlimited" inputMode="numeric" />
        </label>
        <label className="vstack" style={{ gap: 5 }}>
          <span className="ad-lbl">Photo scans / day</span>
          <input className="ad-in" value={photoLimit} onChange={(e) => setPhotoLimit(e.target.value)} placeholder="Unlimited" inputMode="numeric" />
        </label>
      </div>
      <div className="hstack" style={{ gap: 10, flexWrap: "wrap" }}>
        <button type="button" role="switch" aria-checked={isActive} className={`ad-fl${isActive ? " is-on" : ""}`} onClick={() => setIsActive(!isActive)}>
          <span className="ad-sw" aria-hidden><i /></span>
          {isActive ? "Plan is active" : "Plan is inactive"}
        </button>
        <span className="ad-cap">Empty limit = unlimited</span>
        <div className="grow" />
        <button type="button" className="ad-btn" onClick={() => void savePlan()} disabled={!planDirty || savingPlan}>
          {savingPlan ? "Saving…" : "Save plan"}
        </button>
      </div>

      {/* Prices */}
      <div className="ad-card" style={{ overflow: "hidden" }}>
        <div className="ad-scroll">
          <table className="ad-tbl">
            <thead>
              <tr>
                <th>Checkout provider</th>
                <th>Platform</th>
                <th>Currency</th>
                <th>Price</th>
                <th>Billing</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {prices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="ad-cap" style={{ padding: "16px 12px" }}>
                    No prices. Free plans don’t need one.
                  </td>
                </tr>
              ) : (
                prices.map((p) => {
                  const k = keyOf(p);
                  const value = drafts[k] ?? toMajor(p.amount_minor);
                  const dirty = drafts[k] !== undefined && toMinor(drafts[k]) !== p.amount_minor;
                  return (
                    <tr key={k}>
                      <td style={{ fontWeight: 700 }}>{PROVIDER_NAME[p.provider] ?? p.provider}</td>
                      <td>{p.platform}</td>
                      <td><span className="ad-mono">{p.currency}</span></td>
                      <td>
                        <input
                          className={`ad-in${dirty ? " is-dirty" : ""}`}
                          style={{ width: 96 }}
                          value={value}
                          inputMode="decimal"
                          aria-label={`${PROVIDER_NAME[p.provider] ?? p.provider} ${p.platform} price in ${p.currency}`}
                          onChange={(e) => setDrafts((d) => ({ ...d, [k]: e.target.value }))}
                        />
                      </td>
                      <td>{INTERVAL_NAME[p.interval] ?? p.interval}</td>
                      <td><span className={`ad-pill ${p.is_active ? "ad-ok" : "ad-mute"}`}>{p.is_active ? "Live" : "Off"}</span></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {adding && (
        <AddPrice
          planId={plan.id}
          onCancel={() => setAdding(false)}
          onSaved={(price) => {
            setPrices((prev) => [...prev.filter((p) => keyOf(p) !== keyOf(price)), price]);
            setAdding(false);
            setSaved("Price added.");
          }}
        />
      )}

      {error && (
        <div className="ad-notice is-bad" role="alert">
          {error}
        </div>
      )}

      <div className="hstack" style={{ gap: 8, paddingTop: 4, borderTop: "1px solid var(--m-ink-faint)", flexWrap: "wrap" }}>
        {!adding && (
          <button type="button" className="ad-btn" onClick={() => setAdding(true)}>
            <Plus width={14} height={14} aria-hidden />
            Add price
          </button>
        )}
        <span className="ad-cap" role="status">{saved}</span>
        <div className="grow" />
        <button type="button" className="ad-btn" onClick={() => setDrafts({})} disabled={!dirtyPrices.length || savingPrices}>
          Discard
        </button>
        <button type="button" className="ad-btn ad-btn-p" onClick={() => void savePrices()} disabled={!dirtyPrices.length || savingPrices}>
          {savingPrices ? "Saving…" : "Save prices"}
        </button>
      </div>
    </div>
  );
}

function AddPrice({ planId, onSaved, onCancel }: { planId: string; onSaved: (p: AdminPlanPrice) => void; onCancel: () => void }) {
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("web");
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]>("razorpay");
  const [interval, setInterval] = useState<(typeof INTERVALS)[number]>("one_time");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [productId, setProductId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const minor = toMinor(amount);
    if (minor === null) {
      setError("Price must be a number, e.g. 749 or 9.99.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onSaved(
        await putPrice(planId, {
          platform,
          provider,
          amount_minor: minor,
          currency: currency.trim().toUpperCase(),
          interval,
          store_product_id: productId.trim() || null,
          is_active: true,
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save the price.");
    } finally {
      setBusy(false);
    }
  };

  const sel = (label: string, value: string, set: (v: string) => void, opts: readonly string[], names?: Record<string, string>) => (
    <label className="vstack" style={{ gap: 5 }}>
      <span className="ad-lbl">{label}</span>
      <select className="ad-in" value={value} onChange={(e) => set(e.target.value)}>
        {opts.map((o) => (
          <option key={o} value={o}>{names?.[o] ?? o}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="ad-inset">
      <h3 className="ad-h" style={{ fontSize: 12.5 }}>Add or replace a price</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
        {sel("Provider", provider, (v) => setProvider(v as typeof provider), PROVIDERS, PROVIDER_NAME)}
        {sel("Platform", platform, (v) => setPlatform(v as typeof platform), PLATFORMS)}
        {sel("Billing", interval, (v) => setInterval(v as typeof interval), INTERVALS, INTERVAL_NAME)}
        <label className="vstack" style={{ gap: 5 }}>
          <span className="ad-lbl">Currency</span>
          <input className="ad-in" value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} />
        </label>
        <label className="vstack" style={{ gap: 5 }}>
          <span className="ad-lbl">Price</span>
          <input className="ad-in" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="749" />
        </label>
        {(provider === "apple" || provider === "google") && (
          <label className="vstack" style={{ gap: 5 }}>
            <span className="ad-lbl">Store product id</span>
            <input className="ad-in" value={productId} onChange={(e) => setProductId(e.target.value)} />
          </label>
        )}
      </div>
      <span className="ad-cap">A price for a provider + platform that already exists replaces it.</span>
      {error && <span className="ad-cap" role="alert" style={{ color: "var(--text-red)" }}>{error}</span>}
      <div className="hstack" style={{ gap: 8 }}>
        <button type="button" className="ad-btn ad-btn-p" onClick={() => void submit()} disabled={busy || !amount.trim()}>
          {busy ? "Saving…" : "Save price"}
        </button>
        <button type="button" className="ad-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
