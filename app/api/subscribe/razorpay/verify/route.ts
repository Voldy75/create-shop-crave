import crypto from "crypto";
import { requireUser } from "@/lib/auth-guard";
import { grantProAccess } from "@/lib/subscription";

export async function POST(req: Request) {
  const guard = await requireUser();
  if (guard instanceof Response) return guard;
  const { user } = guard;

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return Response.json({ error: "Missing payment fields" }, { status: 400 });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return Response.json({ error: "Razorpay not configured" }, { status: 500 });
  }

  // Verify HMAC signature
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return Response.json({ error: "Invalid payment signature" }, { status: 400 });
  }

  // Grant pro access — Razorpay is a one-time monthly payment, set period to 31 days
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 31);

  await grantProAccess(user.id, "razorpay", {
    providerSubscriptionId: razorpay_payment_id,
    currentPeriodEnd: periodEnd,
  });

  return Response.json({ success: true });
}
