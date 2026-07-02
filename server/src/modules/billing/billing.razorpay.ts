import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env";

const API = "https://api.razorpay.com/v1";

export const isConfigured = (): boolean =>
  Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

const authHeader = (): string =>
  "Basic " + Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

/** Create a Razorpay order for `amount` paise. */
export async function createOrder(
  amount: number,
  receipt: string,
  notes: Record<string, string>
): Promise<RazorpayOrder> {
  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify({ amount, currency: "INR", receipt, notes }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // Never surface the (secret-bearing) auth or provider body to the client.
    console.error(`[razorpay] order create failed (${res.status}): ${detail}`);
    throw new Error("Couldn't start the payment — please try again.");
  }
  return (await res.json()) as RazorpayOrder;
}

/**
 * Verify the checkout callback signature: HMAC-SHA256(order_id|payment_id) keyed
 * by the secret must equal the signature Razorpay returned. Constant-time compare.
 */
export function verifySignature(orderId: string, paymentId: string, signature: string): boolean {
  const expected = createHmac("sha256", env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
