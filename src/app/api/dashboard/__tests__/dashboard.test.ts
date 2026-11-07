import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getSummary } from "@/app/api/dashboard/summary/route";
import { GET as getJobs } from "@/app/api/dashboard/jobs/route";
import { PATCH as updateShop } from "@/app/api/dashboard/shop/route";
import { POST as rotateKey } from "@/app/api/dashboard/agent-key/rotate/route";
import { POST as reprintJob } from "@/app/api/dashboard/jobs/[id]/reprint/route";
import { POST as refundOrder } from "@/app/api/dashboard/orders/[id]/refund/route";

describe("Shop Owner Dashboard API Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/dashboard/summary", () => {
    it("returns shop profile, earnings, job counts, and printer telemetry", async () => {
      const req = new NextRequest("http://localhost:3000/api/dashboard/summary", {
        headers: { "x-dev-owner": "true" },
      });

      const res = await getSummary(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty("shop");
      expect(json.shop.slug).toBe("quickprint");
      expect(json).toHaveProperty("todayEarningsPaise");
      expect(json).toHaveProperty("todayJobsCount");
      expect(json).toHaveProperty("todayPagesCount");
      expect(json).toHaveProperty("printer");
      expect(json.printer).toHaveProperty("status");
    });
  });

  describe("GET /api/dashboard/jobs", () => {
    it("returns paginated jobs list for the shop", async () => {
      const req = new NextRequest("http://localhost:3000/api/dashboard/jobs?limit=10&offset=0", {
        headers: { "x-dev-owner": "true" },
      });

      const res = await getJobs(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(Array.isArray(json.jobs)).toBe(true);
      expect(json).toHaveProperty("totalCount");
      expect(json.limit).toBe(10);
      expect(json.offset).toBe(0);
    });

    it("filters by status and date without errors", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/dashboard/jobs?status=failed&date=2026-11-07",
        {
          headers: { "x-dev-owner": "true" },
        }
      );

      const res = await getJobs(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.jobs)).toBe(true);
    });
  });

  describe("PATCH /api/dashboard/shop", () => {
    it("rejects negative pricing values with 400 Bad Request", async () => {
      const req = new NextRequest("http://localhost:3000/api/dashboard/shop", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-dev-owner": "true",
        },
        body: JSON.stringify({
          bwPricePaise: -50,
        }),
      });

      const res = await updateShop(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("BAD_REQUEST");
    });

    it("updates valid shop rates and emergency pause status", async () => {
      const req = new NextRequest("http://localhost:3000/api/dashboard/shop", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-dev-owner": "true",
        },
        body: JSON.stringify({
          bwPricePaise: 300,
          colorPricePaise: 1500,
          acceptingOrders: false,
        }),
      });

      const res = await updateShop(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.shop.bw_price_paise).toBe(300);
      expect(json.shop.color_price_paise).toBe(1500);
      expect(json.shop.accepting_orders).toBe(false);
    });
  });

  describe("POST /api/dashboard/agent-key/rotate", () => {
    it("generates a high-entropy agent key starting with agk_live_", async () => {
      const req = new NextRequest("http://localhost:3000/api/dashboard/agent-key/rotate", {
        method: "POST",
        headers: { "x-dev-owner": "true" },
      });

      const res = await rotateKey(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.agentKey).toMatch(/^agk_live_[a-f0-9]{48}$/);
    });
  });

  describe("POST /api/dashboard/jobs/[id]/reprint", () => {
    it("re-queues a job for printing", async () => {
      const testJobId = "d0590a37-567e-4078-aee5-1e3c2357790b";
      const req = new NextRequest(
        `http://localhost:3000/api/dashboard/jobs/${testJobId}/reprint`,
        {
          method: "POST",
          headers: { "x-dev-owner": "true" },
        }
      );

      const res = await reprintJob(req, {
        params: Promise.resolve({ id: testJobId }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.jobId).toBe(testJobId);
    });
  });

  describe("POST /api/dashboard/orders/[id]/refund", () => {
    it("processes order refund and confirms cancellation", async () => {
      const testOrderId = "6c459ec7-c533-4f90-84cf-38cb44185799";
      const req = new NextRequest(
        `http://localhost:3000/api/dashboard/orders/${testOrderId}/refund`,
        {
          method: "POST",
          headers: { "x-dev-owner": "true" },
        }
      );

      const res = await refundOrder(req, {
        params: Promise.resolve({ id: testOrderId }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.status).toBe("refunded");
      expect(json).toHaveProperty("refundId");
    });
  });
});
