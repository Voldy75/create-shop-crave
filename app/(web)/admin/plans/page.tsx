"use client";

import { useEffect, useState } from "react";
import { AdminError, AdminLoading, AdminTop } from "../admin-shell";
import { PlanCard } from "./plan-card";
import type { AdminPlan } from "../users/types";

/** Admin → Plans, built to w12c. */
export default function PlansPage() {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/plans")
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setError(data?.error ?? "Couldn’t load plans.");
          return;
        }
        setPlans(data.plans ?? []);
      })
      .catch(() => setError("Couldn’t load plans. Check your connection."))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdated = (updated: AdminPlan) => {
    setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  return (
    <>
      <AdminTop title="Plans">{loading ? <AdminLoading /> : <span className="ad-cap">{plans.length} plans</span>}</AdminTop>
      <div className="ad-body">
        {error && <AdminError>{error}</AdminError>}
        <span className="ad-cap">
          Each plan is one entitlement. Checkout picks the provider; each provider has its own price in its own currency.
        </span>
        {loading ? (
          [0, 1].map((i) => (
            <div key={i} className="ad-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <span className="ad-sk" style={{ width: 160, height: 13 }} />
              <span className="ad-sk" style={{ width: "100%", height: 30 }} />
              <span className="ad-sk" style={{ width: "100%", height: 80 }} />
            </div>
          ))
        ) : plans.length === 0 && !error ? (
          <div className="ad-card" style={{ padding: 18 }}>
            <span className="ad-cap">No plans in the database. Run scripts/sql/admin-console.sql.</span>
          </div>
        ) : (
          plans.map((plan) => <PlanCard key={plan.id} plan={plan} onUpdated={handleUpdated} />)
        )}
      </div>
    </>
  );
}
