import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import crypto from "crypto";

describe("POST /api/webhooks/razorpay", () => {
  const secret = "test_webhook_secret_for_route_tests";

  beforeEach(() => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", secret);
    vi.stubEnv("NODE_ENV", "production"); // Force strict signature verification
  });

  it("returns HTTP 400 when X-Razorpay-Signature is missing or invalid", async () => {
    const rawPayload = JSON.stringify({ event: "payment.captured" });
    const req = new NextRequest("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Razorpay-Signature": "invalid_forged_signature",
      },
      body: rawPayload,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error.code).toBe("INVALID_SIGNATURE");
  });

  it("returns HTTP 400 when body is not valid JSON", async () => {
    const rawPayload = "{ broken_invalid_json ";
    const signature = crypto
      .createHmac("sha256", secret)
      .update(rawPayload)
      .digest("hex");

    const req = new NextRequest("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Razorpay-Signature": signature,
      },
      body: rawPayload,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error.code).toBe("INVALID_JSON");
  });
});

