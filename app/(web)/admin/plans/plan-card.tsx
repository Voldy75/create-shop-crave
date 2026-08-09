"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { CCButton } from "@/components/cc/button";
import { CCCard } from "@/components/cc/card";
import { StatusPill } from "@/components/cc/status-pill";
import { PriceEditor } from "./price-editor";
import type { AdminPlan, AdminPlanPrice } from "../users/types";

/** Renders a number field's value, treating null as the literal word "Unlimited". */
function limitToInput(value: number | null): string {
  return value === null ? "" : String(value);
}

interface PlanCardProps {
  plan: AdminPlan;
  onUpdated: (plan: AdminPlan) => void;
}

export function PlanCard({ plan, onUpdated }: PlanCardProps) {
  const [name, setName] = useState(plan.name);
  const [chatLimit, setChatLimit] = useState(limitToInput(plan.chat_daily_limit));
  const [photoLimit, setPhotoLimit] = useState(limitToInput(plan.photo_daily_limit));
  const [isActive, setIsActive] = useState(plan.is_active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prices, setPrices] = useState<AdminPlanPrice[]>(plan.plan_prices ?? []);

  const dirty =
    name !== plan.name ||
    chatLimit !== limitToInput(plan.chat_daily_limit) ||
    photoLimit !== limitToInput(plan.photo_daily_limit) ||
    isActive !== plan.is_active;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // An empty field means "unlimited" -> send explicit null, never 0 or
      // an omitted key, so the API can tell "unlimited" apart from "unset".
      const chatValue = chatLimit.trim() === "" ? null : Number.parseInt(chatLimit, 10);
      const photoValue = photoLimit.trim() === "" ? null : Number.parseInt(photoLimit, 10);

      if (chatValue !== null && !Number.isFinite(chatValue)) {
        setError("Chat limit must be a number or empty (unlimited)");
        return;
      }
      if (photoValue !== null && !Number.isFinite(photoValue)) {
        setError("Photo limit must be a number or empty (unlimited)");
        return;
      }

      const res = await fetch("/api/admin/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: plan.id,
          name,
          chat_daily_limit: chatValue,
          photo_daily_limit: photoValue,
          is_active: isActive,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Failed to save plan");
        return;
      }
      onUpdated({ ...data.plan, plan_prices: prices });
    } finally {
      setSaving(false);
    }
  };

  const handlePriceSaved = (price: AdminPlanPrice) => {
    setPrices((prev) => {
      const idx = prev.findIndex((p) => p.platform === price.platform && p.provider === price.provider);
      if (idx === -1) return [...prev, price];
      const next = [...prev];
      next[idx] = price;
      return next;
    });
  };

  return (
    <CCCard className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <code className="text-xs font-semibold" style={{ color: "var(--m-ink-soft)" }}>{plan.id}</code>
        <StatusPill tone={isActive ? "active" : "off"}>{isActive ? "Active" : "Inactive"}</StatusPill>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--m-ink-soft)" }}>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg"
            style={{ background: "var(--m-cream-2)", border: "1px solid var(--m-ink-faint)", color: "var(--m-ink)" }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--m-ink-soft)" }}>
          Chat daily limit
          <input
            value={chatLimit}
            onChange={(e) => setChatLimit(e.target.value)}
            placeholder="Unlimited"
            inputMode="numeric"
            className="px-3 py-2 text-sm rounded-lg"
            style={{ background: "var(--m-cream-2)", border: "1px solid var(--m-ink-faint)", color: "var(--m-ink)" }}
          />
          <span style={{ color: "var(--m-ink-soft)" }}>
            {chatLimit.trim() === "" ? "Unlimited" : " "}
          </span>
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--m-ink-soft)" }}>
          Photo daily limit
          <input
            value={photoLimit}
            onChange={(e) => setPhotoLimit(e.target.value)}
            placeholder="Unlimited"
            inputMode="numeric"
            className="px-3 py-2 text-sm rounded-lg"
            style={{ background: "var(--m-cream-2)", border: "1px solid var(--m-ink-faint)", color: "var(--m-ink)" }}
          />
          <span style={{ color: "var(--m-ink-soft)" }}>
            {photoLimit.trim() === "" ? "Unlimited" : " "}
          </span>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm" style={{ color: "var(--m-ink-soft)" }}>
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Plan is active
      </label>

      {error && <p className="text-xs" style={{ color: "var(--m-red)" }}>{error}</p>}

      <CCButton size="sm" onClick={handleSave} disabled={saving || !dirty}>
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        Save plan
      </CCButton>

      <div className="pt-2" style={{ borderTop: "1px solid var(--m-ink-faint)" }}>
        <p className="text-label mb-2" style={{ color: "var(--m-ink-soft)" }}>Prices</p>
        <PriceEditor planId={plan.id} prices={prices} onSaved={handlePriceSaved} />
      </div>
    </CCCard>
  );
}
