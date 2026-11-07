import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyWebhookSignature } from "../razorpay";

describe("verifyWebhookSignature", () => {
  const secret = "test_webhook_secret_xyz123";
  const payload = JSON.stringify({
    event: "payment.captured",
    event_id: "evt_123456",
    payload: {
      payment: {
        entity: {
          id: "pay_98765",
          amount: 2400,
          order_id: "order_abc123",
        },
      },
    },
  });

  it("verifies a valid HMAC SHA-256 signature against raw body", () => {
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const isValid = verifyWebhookSignature(payload, validSignature, secret);
    expect(isValid).toBe(true);
  });

  it("rejects when the payload body has been tampered with by 1 byte", () => {
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    // Tampered payload (change amount from 2400 to 2401)
    const tamperedPayload = payload.replace("2400", "2401");

    const isValid = verifyWebhookSignature(tamperedPayload, validSignature, secret);
    expect(isValid).toBe(false);
  });

  it("rejects when an incorrect webhook secret is used", () => {
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const wrongSecret = "incorrect_secret_999";
    const isValid = verifyWebhookSignature(payload, validSignature, wrongSecret);
    expect(isValid).toBe(false);
  });

  it("rejects when signature is null, undefined, or empty string", () => {
    expect(verifyWebhookSignature(payload, null, secret)).toBe(false);
    expect(verifyWebhookSignature(payload, undefined, secret)).toBe(false);
    expect(verifyWebhookSignature(payload, "", secret)).toBe(false);
  });

  it("rejects when secret is null, undefined, or empty string", () => {
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    expect(verifyWebhookSignature(payload, validSignature, null)).toBe(false);
    expect(verifyWebhookSignature(payload, validSignature, undefined)).toBe(false);
    expect(verifyWebhookSignature(payload, validSignature, "")).toBe(false);
  });
});
