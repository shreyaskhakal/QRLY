import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import type { Order } from "@/lib/types";

/**
 * Generates a secure random 32-byte hexadecimal guest secret.
 */
export function generateGuestSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Computes deterministic SHA-256 hash of a guest secret.
 */
export function hashGuestSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

/**
 * Verifies that the provided guest secret matches the order's stored hash.
 * Returns the Order record if valid, throws AppError otherwise.
 */
export async function verifyOrderAccess(
  supabase: SupabaseClient,
  orderId: string,
  guestSecret: string | null | undefined
): Promise<Order> {
  if (!orderId) {
    throw AppError.badRequest("Missing orderId");
  }

  if (!guestSecret) {
    throw AppError.unauthorized("Missing x-order-secret authentication header");
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    throw AppError.notFound("Order not found");
  }

  const providedHash = hashGuestSecret(guestSecret);
  if (providedHash !== order.guest_secret_hash) {
    throw AppError.unauthorized("Invalid order secret");
  }

  // Check if order has expired
  if (new Date(order.expires_at) < new Date() && order.status === "draft") {
    throw AppError.orderExpired();
  }

  return order as Order;
}

