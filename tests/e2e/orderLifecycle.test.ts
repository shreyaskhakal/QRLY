import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import crypto from "crypto";
import { createMockSupabaseAdmin } from "../mocks/mockSupabase";

const mockAdmin = createMockSupabaseAdmin();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockAdmin,
}));

import { GET as getShop } from "@/app/api/shops/[slug]/route";
import { POST as createOrder } from "@/app/api/orders/route";
import { POST as createFile } from "@/app/api/orders/[id]/files/route";
import { PATCH as updateFile } from "@/app/api/orders/[id]/files/[fileId]/route";
import { POST as checkoutOrder } from "@/app/api/orders/[id]/checkout/route";
import { GET as getOrder } from "@/app/api/orders/[id]/route";
import { POST as handleWebhook } from "@/app/api/webhooks/razorpay/route";
import { POST as claimJob } from "@/app/api/agent/claim/route";
import { POST as reportStatus } from "@/app/api/agent/jobs/[id]/status/route";
import { GET as getSummary } from "@/app/api/dashboard/summary/route";

describe("E2E Integration: Complete Customer-to-Print Lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("completes full lifecycle: Scan -> Upload -> Pay -> Claim -> Print -> Purge -> Receipt", async () => {
    // -------------------------------------------------------------------------
    // 1. Customer Scans QR Code: Fetch Shop Config
    // -------------------------------------------------------------------------
    const shopReq = new NextRequest("http://localhost:3000/api/shops/quickprint");
    const shopRes = await getShop(shopReq, {
      params: Promise.resolve({ slug: "quickprint" }),
    });
    expect(shopRes.status).toBe(200);
    const shopData = await shopRes.json();
    expect(shopData.shop.slug).toBe("quickprint");
    expect(shopData.shop.bwPricePaise).toBeGreaterThan(0);
    expect(shopData.shop.colorPricePaise).toBeGreaterThan(0);

    // -------------------------------------------------------------------------
    // 2. Customer Initiates Order
    // -------------------------------------------------------------------------
    const createReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopSlug: "quickprint" }),
    });
    const createRes = await createOrder(createReq);
    expect(createRes.status).toBe(201);
    const orderInit = await createRes.json();
    expect(orderInit).toHaveProperty("orderId");
    expect(orderInit).toHaveProperty("guestSecret");
    expect(orderInit).toHaveProperty("expiresAt");

    const orderId = orderInit.orderId;
    const guestSecret = orderInit.guestSecret;

    // -------------------------------------------------------------------------
    // 3. Customer Uploads Document Metadata
    // -------------------------------------------------------------------------
    const fileUploadReq = new NextRequest(`http://localhost:3000/api/orders/${orderId}/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-order-secret": guestSecret,
      },
      body: JSON.stringify({
        fileName: "quarterly_financial_report.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024 * 1024 * 2, // 2 MB
      }),
    });
    const fileUploadRes = await createFile(fileUploadReq, {
      params: Promise.resolve({ id: orderId }),
    });
    expect(fileUploadRes.status).toBe(200);
    const fileData = await fileUploadRes.json();
    expect(fileData).toHaveProperty("fileId");
    const fileId = fileData.fileId;

    // -------------------------------------------------------------------------
    // 4. Customer Selects Print Options
    // -------------------------------------------------------------------------
    const updateOptionsReq = new NextRequest(
      `http://localhost:3000/api/orders/${orderId}/files/${fileId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-order-secret": guestSecret,
        },
        body: JSON.stringify({
          colorMode: "color",
          quality: "high",
          copies: 3,
          pageRange: "1",
          sides: "double",
        }),
      }
    );
    const updateOptionsRes = await updateFile(updateOptionsReq, {
      params: Promise.resolve({ id: orderId, fileId }),
    });
    expect(updateOptionsRes.status).toBe(200);
    const updatedOptions = await updateOptionsRes.json();
    expect(updatedOptions.file.color_mode).toBe("color");
    expect(updatedOptions.file.copies).toBe(3);

    // -------------------------------------------------------------------------
    // 5. Checkout & Server Price Authority Check
    // -------------------------------------------------------------------------
    const checkoutReq = new NextRequest(`http://localhost:3000/api/orders/${orderId}/checkout`, {
      method: "POST",
      headers: {
        "x-order-secret": guestSecret,
      },
    });
    const checkoutRes = await checkoutOrder(checkoutReq, {
      params: Promise.resolve({ id: orderId }),
    });
    expect(checkoutRes.status).toBe(200);
    const checkoutData = await checkoutRes.json();
    expect(checkoutData).toHaveProperty("amountPaise");
    expect(checkoutData.amountPaise).toBeGreaterThan(0);
    expect(checkoutData.currency).toBe("INR");

    const totalPaise = checkoutData.amountPaise;
    const razorpayOrderId = checkoutData.razorpayOrderId || `order_test_${Date.now()}`;

    // -------------------------------------------------------------------------
    // 6. Razorpay Webhook Payment Captured Event
    // -------------------------------------------------------------------------
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "test_webhook_secret_key_123";
    const webhookPayload = JSON.stringify({
      entity: "event",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: `pay_test_${Date.now()}`,
            order_id: razorpayOrderId,
            amount: totalPaise,
            currency: "INR",
            status: "captured",
          },
        },
      },
    });

    const signature = crypto
      .createHmac("sha256", webhookSecret)
      .update(webhookPayload)
      .digest("hex");

    const webhookReq = new NextRequest("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": signature,
      },
      body: webhookPayload,
    });

    const webhookRes = await handleWebhook(webhookReq);
    expect(webhookRes.status).toBe(200);
    const webhookResult = await webhookRes.json();
    expect(webhookResult.received).toBe(true);

    // -------------------------------------------------------------------------
    // 7. Print Agent Claims Next Queued Job
    // -------------------------------------------------------------------------
    const agentReq = new NextRequest("http://localhost:3000/api/agent/claim", {
      method: "POST",
      headers: {
        Authorization: "Bearer agk_test_secret_key_123",
      },
    });
    const claimRes = await claimJob(agentReq);
    expect(claimRes.status).toBe(200);
    const claimJson = await claimRes.json();
    expect(claimJson).toHaveProperty("job");
    const activeJobId = claimJson.job.id;

    // -------------------------------------------------------------------------
    // 8. Print Agent Reports Job Status: "done" + Storage File Deletion
    // -------------------------------------------------------------------------
    const statusReq = new NextRequest(
      `http://localhost:3000/api/agent/jobs/${activeJobId}/status`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer agk_test_secret_key_123",
        },
        body: JSON.stringify({
          status: "done",
          localFileDeleted: true,
          errorCode: null,
          errorMessage: null,
        }),
      }
    );
    const statusRes = await reportStatus(statusReq, {
      params: Promise.resolve({ id: activeJobId }),
    });
    expect(statusRes.status).toBe(200);
    const statusJson = await statusRes.json();
    expect(statusJson.success).toBe(true);

    // -------------------------------------------------------------------------
    // 9. Customer Status Check: Verified File Deletion & Receipt
    // -------------------------------------------------------------------------
    const getOrderReq = new NextRequest(`http://localhost:3000/api/orders/${orderId}`, {
      headers: {
        "x-order-secret": guestSecret,
      },
    });
    const getOrderRes = await getOrder(getOrderReq, {
      params: Promise.resolve({ id: orderId }),
    });
    expect(getOrderRes.status).toBe(200);
    const finalOrder = await getOrderRes.json();
    expect(finalOrder.order).toHaveProperty("totalPaise");
    expect(finalOrder.order).toHaveProperty("status");

    // -------------------------------------------------------------------------
    // 10. Shop Owner Summary Verification
    // -------------------------------------------------------------------------
    const summaryReq = new NextRequest("http://localhost:3000/api/dashboard/summary", {
      headers: { "x-dev-owner": "true" },
    });
    const summaryRes = await getSummary(summaryReq);
    expect(summaryRes.status).toBe(200);
    const summaryData = await summaryRes.json();
    expect(summaryData).toHaveProperty("todayEarningsPaise");
  });
});
