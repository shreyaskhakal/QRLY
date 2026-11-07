import { AppError } from "@/lib/errors";
import type {
  PriceCalculationInput,
  ShopPricingRules,
  PriceCalculationResult,
} from "@/lib/types";

/**
 * Pure, deterministic pricing calculation engine.
 * Computes price in integer paise.
 *
 * Formula:
 *   File Price = ceil(selectedPages * copies * baseRate * qualityMultiplier)
 *
 * Rules:
 * - selectedPages must be a positive integer > 0
 * - copies must be an integer between 1 and 50
 * - colorMode must be 'bw' or 'color'
 * - quality must be 'draft', 'normal', or 'high'
 * - All rounding is strictly upward to nearest whole paise
 */
export function calculatePrice(
  input: PriceCalculationInput,
  shop: ShopPricingRules
): PriceCalculationResult {
  const { selectedPages, copies, colorMode, quality } = input;

  // Strict Validation
  if (!Number.isInteger(selectedPages) || selectedPages <= 0) {
    throw AppError.validationError("selectedPages must be an integer greater than 0");
  }

  if (!Number.isInteger(copies) || copies < 1 || copies > 50) {
    throw AppError.validationError("copies must be an integer between 1 and 50");
  }

  let unitRatePaise: number;
  if (colorMode === "bw") {
    unitRatePaise = shop.bw_price_paise;
  } else if (colorMode === "color") {
    unitRatePaise = shop.color_price_paise;
  } else {
    throw AppError.validationError(`Invalid colorMode: '${colorMode}'. Expected 'bw' or 'color'`);
  }

  if (unitRatePaise < 0 || !Number.isInteger(unitRatePaise)) {
    throw AppError.validationError("Shop unit rate in paise must be a non-negative integer");
  }

  let qualityMultiplier: number;
  if (quality === "draft") {
    qualityMultiplier = Number(shop.q_draft_mult);
  } else if (quality === "normal") {
    qualityMultiplier = Number(shop.q_normal_mult);
  } else if (quality === "high") {
    qualityMultiplier = Number(shop.q_high_mult);
  } else {
    throw AppError.validationError(`Invalid quality: '${quality}'. Expected 'draft', 'normal', or 'high'`);
  }

  if (qualityMultiplier <= 0 || isNaN(qualityMultiplier)) {
    throw AppError.validationError("Quality multiplier must be a positive number");
  }

  const billablePages = selectedPages * copies;
  const rawPrice = billablePages * unitRatePaise * qualityMultiplier;

  // Round up to nearest integer paise
  const pricePaise = Math.ceil(rawPrice);

  if (!Number.isSafeInteger(pricePaise)) {
    throw AppError.validationError("Calculated price exceeds safe integer limits");
  }

  return {
    pricePaise,
    unitRatePaise,
    qualityMultiplier,
    billablePages,
  };
}

/**
 * Calculates order total in paise from an array of file prices.
 * Enforces minimum order total of Rs 1.00 (100 paise) unless order has 0 files.
 */
export function calculateOrderTotal(filePricesPaise: number[]): number {
  if (filePricesPaise.length === 0) {
    return 0;
  }

  const sum = filePricesPaise.reduce((acc, p) => {
    if (!Number.isInteger(p) || p < 0) {
      throw AppError.validationError("File price must be a non-negative integer paise");
    }
    return acc + p;
  }, 0);

  // Enforce minimum order total of 100 paise (Rs 1.00)
  return Math.max(100, sum);
}

