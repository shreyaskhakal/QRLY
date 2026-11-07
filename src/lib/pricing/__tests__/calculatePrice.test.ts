import { describe, it, expect } from "vitest";
import { calculatePrice, calculateOrderTotal } from "../calculatePrice";
import type { ShopPricingRules, ColorMode, PrintQuality } from "@/lib/types";

describe("calculatePrice", () => {
  const defaultShop: ShopPricingRules = {
    bw_price_paise: 200,   // Rs 2.00
    color_price_paise: 1000, // Rs 10.00
    q_draft_mult: 1.0,
    q_normal_mult: 1.0,
    q_high_mult: 1.5,
  };

  it("calculates standard Black & White normal quality price correctly", () => {
    // 10 pages * 1 copy * 200 paise * 1.0 = 2000 paise (Rs 20.00)
    const result = calculatePrice(
      { selectedPages: 10, copies: 1, colorMode: "bw", quality: "normal" },
      defaultShop
    );
    expect(result.pricePaise).toBe(2000);
    expect(result.unitRatePaise).toBe(200);
    expect(result.qualityMultiplier).toBe(1.0);
    expect(result.billablePages).toBe(10);
  });

  it("calculates standard Color normal quality price correctly", () => {
    // 10 pages * 1 copy * 1000 paise * 1.0 = 10000 paise (Rs 100.00)
    const result = calculatePrice(
      { selectedPages: 10, copies: 1, colorMode: "color", quality: "normal" },
      defaultShop
    );
    expect(result.pricePaise).toBe(10000);
    expect(result.unitRatePaise).toBe(1000);
    expect(result.billablePages).toBe(10);
  });

  it("applies Draft quality multiplier (1.0x) correctly", () => {
    // 5 pages * 2 copies * 200 paise * 1.0 = 2000 paise
    const result = calculatePrice(
      { selectedPages: 5, copies: 2, colorMode: "bw", quality: "draft" },
      defaultShop
    );
    expect(result.pricePaise).toBe(2000);
    expect(result.qualityMultiplier).toBe(1.0);
  });

  it("applies High quality multiplier (1.5x) correctly", () => {
    // 5 pages * 2 copies * 200 paise * 1.5 = 3000 paise (Rs 30.00)
    const result = calculatePrice(
      { selectedPages: 5, copies: 2, colorMode: "bw", quality: "high" },
      defaultShop
    );
    expect(result.pricePaise).toBe(3000);
    expect(result.qualityMultiplier).toBe(1.5);
    expect(result.billablePages).toBe(10);
  });

  it("calculates color high quality with multiple copies correctly", () => {
    // 3 pages * 3 copies * 1000 paise * 1.5 = 13500 paise
    const result = calculatePrice(
      { selectedPages: 3, copies: 3, colorMode: "color", quality: "high" },
      defaultShop
    );
    expect(result.pricePaise).toBe(13500);
    expect(result.billablePages).toBe(9);
  });

  it("always rounds up fractional paise strictly to the nearest integer paise", () => {
    // Shop with custom non-round rates to test Math.ceil
    const customShop: ShopPricingRules = {
      bw_price_paise: 155, // Rs 1.55
      color_price_paise: 825,
      q_draft_mult: 0.95, // 1 * 1 * 155 * 0.95 = 147.25 -> ceil = 148
      q_normal_mult: 1.0,
      q_high_mult: 1.33,  // 1 * 1 * 155 * 1.33 = 206.15 -> ceil = 207
    };

    const draftResult = calculatePrice(
      { selectedPages: 1, copies: 1, colorMode: "bw", quality: "draft" },
      customShop
    );
    expect(draftResult.pricePaise).toBe(148);

    const highResult = calculatePrice(
      { selectedPages: 1, copies: 1, colorMode: "bw", quality: "high" },
      customShop
    );
    expect(highResult.pricePaise).toBe(207);
  });

  it("rejects zero and negative page counts", () => {
    expect(() =>
      calculatePrice(
        { selectedPages: 0, copies: 1, colorMode: "bw", quality: "normal" },
        defaultShop
      )
    ).toThrowError("selectedPages must be an integer greater than 0");

    expect(() =>
      calculatePrice(
        { selectedPages: -5, copies: 1, colorMode: "bw", quality: "normal" },
        defaultShop
      )
    ).toThrowError("selectedPages must be an integer greater than 0");
  });

  it("rejects invalid copies (0 or > 50)", () => {
    expect(() =>
      calculatePrice(
        { selectedPages: 1, copies: 0, colorMode: "bw", quality: "normal" },
        defaultShop
      )
    ).toThrowError("copies must be an integer between 1 and 50");

    expect(() =>
      calculatePrice(
        { selectedPages: 1, copies: 51, colorMode: "bw", quality: "normal" },
        defaultShop
      )
    ).toThrowError("copies must be an integer between 1 and 50");
  });

  it("rejects invalid colorMode", () => {
    expect(() =>
      calculatePrice(
        { selectedPages: 1, copies: 1, colorMode: "sepia" as unknown as ColorMode, quality: "normal" },
        defaultShop
      )
    ).toThrowError("Invalid colorMode");
  });

  it("rejects invalid quality option", () => {
    expect(() =>
      calculatePrice(
        { selectedPages: 1, copies: 1, colorMode: "bw", quality: "ultra" as unknown as PrintQuality },
        defaultShop
      )
    ).toThrowError("Invalid quality");
  });
});

describe("calculateOrderTotal", () => {
  it("enforces minimum order amount of 100 paise (Rs 1.00) when files exist", () => {
    // Single file that costs 50 paise
    const total = calculateOrderTotal([50]);
    expect(total).toBe(100);
  });

  it("returns exact sum when order total exceeds 100 paise", () => {
    const total = calculateOrderTotal([2000, 3000, 1500]);
    expect(total).toBe(6500);
  });

  it("returns 0 for empty order (0 files)", () => {
    const total = calculateOrderTotal([]);
    expect(total).toBe(0);
  });

  it("rejects negative or non-integer file prices", () => {
    expect(() => calculateOrderTotal([200, -50])).toThrowError(
      "File price must be a non-negative integer paise"
    );
    expect(() => calculateOrderTotal([200.5])).toThrowError(
      "File price must be a non-negative integer paise"
    );
  });
});

