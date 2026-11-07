import { describe, it, expect } from "vitest";
import { checkRateLimit } from "@/lib/security/rateLimit";

describe("Rate Limiting Security Engine", () => {
  it("allows initial requests within the rate limit threshold", () => {
    const key = `test_ip_${Date.now()}`;
    const res1 = checkRateLimit(key, 5, 10);
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(4);
    expect(res1.limit).toBe(5);

    const res2 = checkRateLimit(key, 5, 10);
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(3);
  });

  it("blocks requests once the threshold is exceeded", () => {
    const key = `test_blocked_ip_${Date.now()}`;
    // Limit of 3
    checkRateLimit(key, 3, 10); // 1
    checkRateLimit(key, 3, 10); // 2
    checkRateLimit(key, 3, 10); // 3

    const blocked = checkRateLimit(key, 3, 10);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.reset).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("resets window properly after expiration", async () => {
    const key = `test_expire_${Date.now()}`;
    // Limit 1, window 1 second
    const res1 = checkRateLimit(key, 1, 1);
    expect(res1.success).toBe(true);

    const res2 = checkRateLimit(key, 1, 1);
    expect(res2.success).toBe(false);

    // Wait 1.1s for window to reset
    await new Promise((r) => setTimeout(r, 1100));

    const res3 = checkRateLimit(key, 1, 1);
    expect(res3.success).toBe(true);
    expect(res3.remaining).toBe(0);
  });
});
