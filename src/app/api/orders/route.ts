import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, errorResponse } from "@/lib/errors";
import { generateGuestSecret, hashGuestSecret } from "@/lib/auth/guestAuth";

const CreateOrderSchema = z.object({
  shopSlug: z.string().min(1, "Shop slug is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateOrderSchema.safeParse(body);

    if (!parsed.success) {
      throw AppError.validationError(parsed.error.errors[0]?.message ?? "Invalid request body");
    }

    const { shopSlug } = parsed.data;
    const supabase = createAdminClient();

    // 1. Fetch shop
    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("id, accepting_orders, order_expiry_minutes")
      .eq("slug", shopSlug)
      .single();

    if (shopError || !shop) {
      throw AppError.notFound(`Shop '${shopSlug}' not found`);
    }

    // 2. Availability Guard: Shop pause check
    if (!shop.accepting_orders) {
      throw AppError.printerOffline("This print shop is currently not accepting new orders.");
    }

    // 3. Availability Guard: Printer online check
    const { data: printer } = await supabase
      .from("printers")
      .select("status, last_seen_at")
      .eq("shop_id", shop.id)
      .limit(1)
      .maybeSingle();

    if (printer) {
      const isStale =
        !printer.last_seen_at ||
        Date.now() - new Date(printer.last_seen_at).getTime() > 45000;

      if (printer.status === "offline" || printer.status === "error" || isStale) {
        throw AppError.printerOffline();
      }
    }

    // 4. Generate guest secret & hash
    const guestSecret = generateGuestSecret();
    const guestSecretHash = hashGuestSecret(guestSecret);

    // 5. Expiration time (default 30 mins)
    const expiryMinutes = shop.order_expiry_minutes || 30;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

    // 6. Insert order
    const { data: order, error: insertError } = await supabase
      .from("orders")
      .insert({
        shop_id: shop.id,
        guest_secret_hash: guestSecretHash,
        status: "draft",
        total_paise: 0,
        expires_at: expiresAt,
      })
      .select("id, expires_at")
      .single();

    if (insertError || !order) {
      throw AppError.internal("Failed to initialize customer order");
    }

    return NextResponse.json(
      {
        orderId: order.id,
        guestSecret,
        expiresAt: order.expires_at,
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

