"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { CCButton } from "@/components/cc/button";
import type { AdminPlanPrice } from "../users/types";

const PLATFORMS = ["web", "ios", "android"] as const;
const PROVIDERS = ["razorpay", "stripe", "apple", "google"] as const;
const INTERVALS = ["one_time", "month", "year"] as const;

interface PriceEditorProps {
  planId: string;
  prices: AdminPlanPrice[];
  onSaved: (price: AdminPlanPrice) => void;
}

export function PriceEditor({ planId, prices, onSaved }: PriceEditorProps) {
  const [showForm, setShowForm] = useState(false);
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("web");
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]>("razorpay");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [interval, setInterval] = useState<(typeof INTERVALS)[number]>("month");
  const [storeProductId, setStoreProductId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const amountMinor = Number.parseInt(amount, 10);
    if (!Number.isFinite(amountMinor) || amountMinor < 0) {
      setError("Amount must be a non-negative integer (minor units)");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/plans/${planId}/prices`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          provider,
          amount_minor: amountMinor,
          currency,
          interval,
          store_product_id: storeProductId.trim() || null,
          is_active: isActive,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Failed to save price");
        return;
      }
      onSaved(data.price);
      setShowForm(false);
      setAmount("");
      setStoreProductId("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      {prices.length === 0 && !showForm && (
        <p className="text-xs" style={{ color: "var(--m-ink-soft)" }}>No prices configured.</p>
      )}
      {prices.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                {["Platform", "Provider", "Amount", "Currency", "Interval", "Store product id", "Active"].map((h) => (
                  <th key={h} className="text-left px-2 py-1.5 text-label" style={{ color: "var(--m-ink-soft)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prices.map((p) => (
                <tr key={`${p.plan_id}:${p.platform}:${p.provider}`} style={{ borderTop: "1px solid var(--m-ink-faint)" }}>
                  <td className="px-2 py-1.5" style={{ color: "var(--m-ink)" }}>{p.platform}</td>
                  <td className="px-2 py-1.5" style={{ color: "var(--m-ink)" }}>{p.provider}</td>
                  <td className="px-2 py-1.5" style={{ color: "var(--m-ink)" }}>{p.amount_minor}</td>
                  <td className="px-2 py-1.5" style={{ color: "var(--m-ink)" }}>{p.currency}</td>
                  <td className="px-2 py-1.5" style={{ color: "var(--m-ink)" }}>{p.interval}</td>
                  <td className="px-2 py-1.5" style={{ color: "var(--m-ink-soft)" }}>{p.store_product_id ?? "—"}</td>
                  <td className="px-2 py-1.5" style={{ color: "var(--m-ink-soft)" }}>{p.is_active ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <p className="text-xs" style={{ color: "#ff453a" }}>{error}</p>
      )}

      {showForm ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 rounded-xl" style={{ background: "var(--m-cream-2)", border: "1px solid var(--m-ink-faint)" }}>
          <LabeledSelect label="Platform" value={platform} onChange={(v) => setPlatform(v as typeof platform)} options={PLATFORMS} />
          <LabeledSelect label="Provider" value={provider} onChange={(v) => setProvider(v as typeof provider)} options={PROVIDERS} />
          <LabeledSelect label="Interval" value={interval} onChange={(v) => setInterval(v as typeof interval)} options={INTERVALS} />
          <LabeledInput label="Amount (minor units)" value={amount} onChange={setAmount} placeholder="e.g. 49900" />
          <LabeledInput label="Currency" value={currency} onChange={setCurrency} placeholder="INR" />
          <LabeledInput label="Store product id" value={storeProductId} onChange={setStoreProductId} placeholder="optional" />
          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--m-ink-soft)" }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
          <div className="col-span-full flex gap-2">
            <CCButton size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save price
            </CCButton>
            <CCButton size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </CCButton>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
          style={{ background: "var(--m-cream-2)", color: "var(--m-ink-soft)", border: "1px solid var(--m-ink-faint)" }}
        >
          <Plus className="w-3 h-3" />
          Add / update price
        </button>
      )}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--m-ink-soft)" }}>
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-2 py-1.5 text-sm rounded-lg"
        style={{ background: "var(--m-card)", border: "1px solid var(--m-ink-faint)", color: "var(--m-ink)" }}
      />
    </label>
  );
}

function LabeledSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: string) => void;
  options: readonly T[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--m-ink-soft)" }}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1.5 text-sm rounded-lg"
        style={{ background: "var(--m-card)", border: "1px solid var(--m-ink-faint)", color: "var(--m-ink)" }}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
