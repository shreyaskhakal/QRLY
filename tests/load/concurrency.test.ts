import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { createMockSupabaseAdmin } from "../mocks/mockSupabase";

const mockAdmin = createMockSupabaseAdmin();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockAdmin,
}));

import { POST as createOrder } from "@/app/api/orders/route";
import { POST as createFile } from "@/app/api/orders/[id]/files/route";
import { PATCH as updateFile } from "@/app/api/orders/[id]/files/[fileId]/route";
import { POST as checkoutOrder } from "@/app/api/orders/[id]/checkout/route";
import { calculatePrice } from "@/lib/pricing/calculatePrice";

describe("Concurrency & High-Load Order Ingestion", () => {
  it("processes 20 simultaneous concurrent customer orders with zero collision or float drift", async () => {
    const CONCURRENT_COUNT = 20;

    // Simulate 20 distinct customers scanning kiosk and uploading concurrently
    const orderPromises = Array.from({ length: CONCURRENT_COUNT }, async (_, idx) => {
      // 1. Create Order
      const createReq = new NextRequest("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopSlug: "quickprint" }),
      });
      const createRes = await createOrder(createReq);
      expect(createRes.status).toBe(201);
      const { orderId, guestSecret } = await createRes.json();

      // 2. Attach File
      const fileReq = new NextRequest(`http://localhost:3000/api/orders/${orderId}/files`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-order-secret": guestSecret,
        },
        body: JSON.stringify({
          fileName: `document_worker_${idx + 1}.pdf`,
          mimeType: "application/pdf",
          sizeBytes: 500000 + idx * 10000,
        }),
      });
      const fileRes = await createFile(fileReq, {
        params: Promise.resolve({ id: orderId }),
      });
      expect(fileRes.status).toBe(200);
      const { fileId } = await fileRes.json();

      // 3. Configure Options
      const isColor = idx % 2 === 0;
      const copies = (idx % 3) + 1;
      const updateReq = new NextRequest(
        `http://localhost:3000/api/orders/${orderId}/files/${fileId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-order-secret": guestSecret,
          },
          body: JSON.stringify({
            colorMode: isColor ? "color" : "bw",
            quality: "normal",
            copies,
            pageRange: "1",
            sides: "single",
          }),
        }
      );
      const updateRes = await updateFile(updateReq, {
        params: Promise.resolve({ id: orderId, fileId }),
      });
      expect(updateRes.status).toBe(200);

      // 4. Checkout
      const checkoutReq = new NextRequest(`http://localhost:3000/api/orders/${orderId}/checkout`, {
        method: "POST",
        headers: { "x-order-secret": guestSecret },
      });
      const checkoutRes = await checkoutOrder(checkoutReq, {
        params: Promise.resolve({ id: orderId }),
      });
      expect(checkoutRes.status).toBe(200);
      const { amountPaise } = await checkoutRes.json();

      // Mathematical verification of integer paise calculation
      const calculated = calculatePrice(
        {
          selectedPages: 1,
          copies,
          colorMode: isColor ? "color" : "bw",
          quality: "normal",
        },
        {
          bw_price_paise: 200,
          color_price_paise: 1000,
          q_draft_mult: 1.0,
          q_normal_mult: 1.0,
          q_high_mult: 1.5,
        }
      );

      return {
        orderId,
        guestSecret,
        totalPaise: amountPaise,
        expectedPaise: calculated.pricePaise,
      };
    });

    const results = await Promise.all(orderPromises);

    // Verify all 20 orders completed
    expect(results.length).toBe(CONCURRENT_COUNT);

    // Verify uniqueness of order IDs (zero collision)
    const orderIds = new Set(results.map((r) => r.orderId));
    expect(orderIds.size).toBe(CONCURRENT_COUNT);

    // Verify uniqueness of guest secrets
    const secrets = new Set(results.map((r) => r.guestSecret));
    expect(secrets.size).toBe(CONCURRENT_COUNT);

    // Verify integer paise precision across all orders
    let aggregatedPaise = 0;
    let expectedAggregatedPaise = 0;

    for (const r of results) {
      expect(Number.isInteger(r.totalPaise)).toBe(true);
      expect(r.totalPaise).toBe(r.expectedPaise);
      aggregatedPaise += r.totalPaise;
      expectedAggregatedPaise += r.expectedPaise;
    }

    expect(aggregatedPaise).toBe(expectedAggregatedPaise);
    expect(aggregatedPaise).toBeGreaterThan(0);
  });
});
