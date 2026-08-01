"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { PlanCard } from "./plan-card";
import type { AdminPlan } from "../users/types";

export default function PlansPage() {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/plans")
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setError(data?.error ?? "Failed to load plans");
          return;
        }
        setPlans(data.plans ?? []);
      })
      .catch(() => setError("Failed to load plans. Check your connection."))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdated = (updated: AdminPlan) => {
    setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="font-bold text-lg" style={{ color: "var(--cc-text-primary)", letterSpacing: "-0.02em" }}>
          Plans
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--cc-text-tertiary)" }}>
          Leave a limit field empty to make it unlimited.
        </p>
      </div>

      {error && (
        <div
          className="rounded-xl p-4 text-sm"
          style={{ background: "rgba(255,69,58,0.08)", color: "#ff453a", border: "1px solid rgba(255,69,58,0.15)" }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--cc-text-tertiary)" }} />
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onUpdated={handleUpdated} />
          ))}
        </div>
      )}
    </main>
  );
}
