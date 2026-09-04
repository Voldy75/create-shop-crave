import Razorpay from "razorpay";
import { requireUser } from "@/lib/auth-guard";

const PRO_AMOUNT_INR = 74900; // ₹749 in paise

export async function POST() {
  const guard = await requireUser();
  if (guard instanceof Response) return guard;
  const { user } = guard;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return Response.json({ error: "Razorpay not configured" }, { status: 500 });
  }

  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

  const order = await razorpay.orders.create({
    amount: PRO_AMOUNT_INR,
    currency: "INR",
    notes: { user_id: user.id, email: user.email ?? "" },
  });

  return Response.json({
    orderId: order.id,
    amount: PRO_AMOUNT_INR,
    currency: "INR",
    keyId,
    userName: user.user_metadata?.full_name ?? "",
    userEmail: user.email ?? "",
  });
}
