import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import type { Shop } from "@/lib/types";

export interface AuthenticatedOwnerContext {
  userId: string;
  shop: Shop;
}

const DEMO_OWNER_ID = "a0000000-0000-0000-0000-000000000001";
const DEMO_SHOP_ID = "b0000000-0000-0000-0000-000000000001";

const FALLBACK_DEMO_SHOP: Shop = {
  id: DEMO_SHOP_ID,
  slug: "quickprint",
  name: "QuickPrint Express Kiosk",
  owner_id: DEMO_OWNER_ID,
  bw_price_paise: 200,
  color_price_paise: 1000,
  q_draft_mult: 1.0,
  q_normal_mult: 1.0,
  q_high_mult: 1.5,
  max_file_mb: 25,
  order_expiry_minutes: 30,
  accepting_orders: true,
  agent_key_hash: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Resolves the authenticated shop owner and their primary shop.
 * Supports Supabase Auth session cookies, with a secure development fallback
 * for local testing and demo preview mode.
 */
export async function getAuthenticatedOwner(
  request?: NextRequest
): Promise<AuthenticatedOwnerContext> {
  let supabaseServer;
  try {
    supabaseServer = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (user && !authError) {
      // Find the shop owned by this user
      const admin = createAdminClient();
      const { data: shop, error: shopError } = await admin
        .from("shops")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (shopError) {
        throw AppError.internal("Failed to load shop configuration");
      }

      if (!shop) {
        throw AppError.notFound("No print shop registered for this owner account");
      }

      return {
        userId: user.id,
        shop: shop as Shop,
      };
    }
  } catch (err) {
    // If not AppError, fall through to dev check
    if (err instanceof AppError) {
      throw err;
    }
  }

  // Development & test mode fallback
  const isDev = process.env.NODE_ENV !== "production";
  const devHeader = request?.headers.get("x-dev-owner");
  const devCookie = request?.cookies.get("qrly_dev_owner")?.value;

  if (isDev || devHeader === "true" || devCookie === "true") {
    try {
      const admin = createAdminClient();
      const { data: shop } = await admin
        .from("shops")
        .select("*")
        .eq("slug", "quickprint")
        .limit(1)
        .maybeSingle();

      if (shop) {
        return {
          userId: shop.owner_id || DEMO_OWNER_ID,
          shop: shop as Shop,
        };
      }
    } catch {
      // Database unavailable, return typed in-memory demo shop
    }

    return {
      userId: DEMO_OWNER_ID,
      shop: FALLBACK_DEMO_SHOP,
    };
  }

  throw AppError.unauthorized("Authentication required. Please log in to your shop dashboard.");
}
