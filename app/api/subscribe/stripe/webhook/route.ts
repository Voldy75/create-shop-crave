import Stripe from "stripe";
import { grantProAccess } from "@/lib/subscription";

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return Response.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const stripe = new Stripe(stripeKey);
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return Response.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "invoice.payment_succeeded"
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = event.data.object as any;
    const userId =
      "metadata" in session && session.metadata?.user_id
        ? session.metadata.user_id
        : null;

    if (!userId) {
      console.error("Stripe webhook: missing user_id in metadata", event.id);
      return Response.json({ received: true });
    }

    const subscriptionId =
      "subscription" in session && typeof session.subscription === "string"
        ? session.subscription
        : undefined;

    const customerId =
      "customer" in session && typeof session.customer === "string"
        ? session.customer
        : undefined;

    // Fetch subscription to get period end
    let periodEnd: Date | undefined;
    if (subscriptionId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sub = await stripe.subscriptions.retrieve(subscriptionId) as any;
      periodEnd = new Date(sub.current_period_end * 1000);
    }

    await grantProAccess(userId, "stripe", {
      providerSubscriptionId: subscriptionId,
      providerCustomerId: customerId,
      currentPeriodEnd: periodEnd,
    });
  }

  if (event.type === "customer.subscription.deleted") {
    // Subscription cancelled — mark as cancelled in DB
    // We leave this to a future enhancement; access expires naturally via current_period_end
  }

  return Response.json({ received: true });
}
