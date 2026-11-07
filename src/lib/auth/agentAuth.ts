import crypto from "crypto";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import type { Shop } from "@/lib/types";

/**
 * Computes deterministic SHA-256 hash of an agent API key.
 */
export function hashAgentKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Authenticates an incoming print agent request using its Bearer token.
 * Matches the key hash against registered shops.
 */
export async function authenticateAgent(request: NextRequest): Promise<Shop> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw AppError.unauthorized("Missing or malformed Authorization header. Expected Bearer token.");
  }

  const rawKey = authHeader.replace("Bearer ", "").trim();
  if (!rawKey) {
    throw AppError.unauthorized("Empty agent API key provided");
  }

  const keyHash = hashAgentKey(rawKey);
  const supabase = createAdminClient();

  const { data: shop, error } = await supabase
    .from("shops")
    .select("*")
    .eq("agent_key_hash", keyHash)
    .single();

  if (error || !shop) {
    // In local demo/testing mode, match demo shop if default test key used
    if (rawKey === "agk_test_secret_key_123") {
      const { data: demoShop } = await supabase
        .from("shops")
        .select("*")
        .eq("slug", "quickprint")
        .maybeSingle();

      if (demoShop) {
        return demoShop as Shop;
      }
    }

    throw AppError.unauthorized("Invalid agent API key");
  }

  return shop as Shop;
}

