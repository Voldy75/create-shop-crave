/**
 * Server-side account helpers for WF11 / F10 — the pass check that gates
 * deletion, and the deletion itself.
 *
 * WHAT DELETION RELIES ON. Every server table that holds user data references
 * auth.users with ON DELETE CASCADE (verified across scripts/sql/*.sql, ten
 * references). So removing the auth user removes every server row in one
 * transaction — meal logs, goals, usage, notification subscriptions, MCP
 * connections, the profile, the subscription row. There are no user files in
 * Supabase Storage.
 *
 * WHAT IT CANNOT REACH. Saved recipes, the meal plan, diet preferences, tastes
 * and the weight goal live in localStorage. The client clears them on the
 * device that deletes; other browsers keep their copy until they are cleared
 * there. The screens say so rather than implying a deletion they cannot do.
 *
 * THE BILLING HAZARD — read before touching this file. Stripe checkout uses
 * mode "subscription", i.e. RECURRING monthly billing (Razorpay is a one-time
 * 31-day pass). Deleting an account that still has a live Stripe subscription
 * would leave the card being charged every month for an account that no
 * longer exists, with nothing left to cancel it from. So deletion cancels the
 * Stripe subscription FIRST and ABORTS ENTIRELY if that fails. Never reorder
 * this, and never make the cancel best-effort.
 */

import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getProvider } from "@/lib/mcp/registry";
import { revokeToken } from "@/lib/mcp/oauth";

export interface PassStatus {
  provider: "razorpay" | "stripe";
  /** Stripe renews monthly; Razorpay is a one-time 31-day pass. */
  recurring: boolean;
  endsAt: string | null;
  daysLeft: number | null;
  subscriptionId: string | null;
}

/** The user's live paid entitlement, or null. */
export async function getPassStatus(userId: string): Promise<PassStatus | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("pro_subscriptions")
    .select("provider, status, current_period_end, provider_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  if (data.status !== "active" && data.status !== "trialing") return null;

  const endsAt: string | null = data.current_period_end ?? null;
  const msLeft = endsAt ? new Date(endsAt).getTime() - Date.now() : null;
  // A Razorpay pass whose period has ended is not live, whatever its status.
  if (msLeft !== null && msLeft <= 0 && data.provider === "razorpay") return null;

  return {
    provider: data.provider,
    recurring: data.provider === "stripe",
    endsAt,
    daysLeft: msLeft !== null ? Math.max(0, Math.ceil(msLeft / 86_400_000)) : null,
    subscriptionId: data.provider_subscription_id ?? null,
  };
}

export type DeleteStepId = "billing" | "connections" | "account";

export interface DeleteStep {
  id: DeleteStepId;
  ok: boolean;
  detail?: string;
}

export class DeletionAborted extends Error {
  constructor(public steps: DeleteStep[], message: string) {
    super(message);
  }
}

/**
 * Delete a user. Steps run in a fixed order and each is reported back, so the
 * in-progress screen ticks off work that actually happened rather than
 * animating a fixed list.
 *
 * Throws DeletionAborted — with nothing deleted — if billing cannot be
 * stopped. A failure AFTER billing is cancelled is reported, not thrown: the
 * user is no longer being charged, and they can retry.
 */
export async function deleteAccount(userId: string, pass: PassStatus | null): Promise<DeleteStep[]> {
  const steps: DeleteStep[] = [];

  // 1. Billing. Must succeed (or be unnecessary) before anything is deleted.
  if (pass?.recurring) {
    if (!pass.subscriptionId) {
      steps.push({ id: "billing", ok: false, detail: "no_subscription_id" });
      throw new DeletionAborted(steps, "Active Stripe subscription has no id to cancel");
    }
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      steps.push({ id: "billing", ok: false, detail: "stripe_not_configured" });
      throw new DeletionAborted(steps, "Cannot cancel the Stripe subscription: Stripe is not configured");
    }
    try {
      await new Stripe(key).subscriptions.cancel(pass.subscriptionId);
    } catch (e) {
      steps.push({ id: "billing", ok: false, detail: "cancel_failed" });
      throw new DeletionAborted(
        steps,
        `Stripe cancel failed: ${e instanceof Error ? e.message.slice(0, 160) : "unknown"}`
      );
    }
  }
  steps.push({ id: "billing", ok: true, detail: pass?.recurring ? "cancelled" : "nothing_to_cancel" });

  // 2. Connected store accounts. Revoke at the provider (best effort — tokens
  // expire on their own); the rows themselves go with the cascade below.
  const supabase = await createServiceClient();
  const { data: conns } = await supabase
    .from("mcp_connections")
    .select("provider_id, access_token")
    .eq("user_id", userId);
  for (const c of conns ?? []) {
    const provider = await getProvider(c.provider_id);
    if (provider) await revokeToken(provider, c.access_token);
  }
  steps.push({ id: "connections", ok: true, detail: `${conns?.length ?? 0}` });

  // 3. The account. Cascades every server row that references the user.
  const { error } = await supabase.auth.admin.deleteUser(userId);
  steps.push({ id: "account", ok: !error, detail: error?.message?.slice(0, 160) });

  return steps;
}
