import crypto from "crypto";
import Razorpay from "razorpay";
import { AppError } from "@/lib/errors";

/**
 * Initializes a Razorpay SDK client instance using server environment variables.
 */
export function getRazorpayClient(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw AppError.internal("Razorpay credentials are not configured in environment");
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

/**
 * Verifies the authenticity of an incoming Razorpay webhook payload
 * using HMAC SHA-256 against the raw request body.
 *
 * @param rawBody The exact raw string body of the incoming webhook request
 * @param signature The signature string from the 'X-Razorpay-Signature' header
 * @param secret The webhook secret configured in the Razorpay dashboard
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string | null | undefined
): boolean {
  if (!signature || !secret || !rawBody) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature, "utf-8"),
      Buffer.from(expectedSignature, "utf-8")
    );
  } catch {
    return false;
  }
}

/**
 * Issues a full or partial refund for a captured Razorpay payment.
 */
export async function createPaymentRefund(
  paymentId: string,
  amountPaise?: number,
  notes?: Record<string, string>
) {
  const client = getRazorpayClient();
  return client.payments.refund(paymentId, {
    ...(amountPaise ? { amount: amountPaise } : {}),
    notes,
  });
}

