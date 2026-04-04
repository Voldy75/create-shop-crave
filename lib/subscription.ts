import { createServiceClient } from "@/lib/supabase/server";

export async function isProUser(userId: string): Promise<boolean> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("is_pro_user", { p_user_id: userId });
  if (error) {
    console.error("Pro check error:", error.message);
    return false;
  }
  return data === true;
}

export async function grantProAccess(
  userId: string,
  provider: "razorpay" | "stripe",
  opts: {
    providerSubscriptionId?: string;
    providerCustomerId?: string;
    currentPeriodEnd?: Date;
  } = {}
): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase.from("pro_subscriptions").upsert(
    {
      user_id: userId,
      provider,
      status: "active",
      provider_subscription_id: opts.providerSubscriptionId ?? null,
      provider_customer_id: opts.providerCustomerId ?? null,
      current_period_end: opts.currentPeriodEnd?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    console.error("Grant pro access error:", error.message);
    throw new Error("Failed to grant pro access");
  }
}
