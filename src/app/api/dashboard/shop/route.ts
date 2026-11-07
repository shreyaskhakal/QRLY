import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedOwner } from "@/lib/auth/ownerAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, errorResponse } from "@/lib/errors";

const updateShopSchema = z.object({
  bwPricePaise: z.number().int().min(0).optional(),
  colorPricePaise: z.number().int().min(0).optional(),
  qDraftMult: z.number().positive().optional(),
  qNormalMult: z.number().positive().optional(),
  qHighMult: z.number().positive().optional(),
  maxFileMb: z.number().int().positive().optional(),
  orderExpiryMinutes: z.number().int().positive().optional(),
  acceptingOrders: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const { shop } = await getAuthenticatedOwner(request);
    const body = await request.json().catch(() => ({}));
    const validated = updateShopSchema.safeParse(body);

    if (!validated.success) {
      throw AppError.badRequest("Invalid shop configuration");
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (validated.data.bwPricePaise !== undefined) {
      updates.bw_price_paise = validated.data.bwPricePaise;
    }
    if (validated.data.colorPricePaise !== undefined) {
      updates.color_price_paise = validated.data.colorPricePaise;
    }
    if (validated.data.qDraftMult !== undefined) {
      updates.q_draft_mult = validated.data.qDraftMult;
    }
    if (validated.data.qNormalMult !== undefined) {
      updates.q_normal_mult = validated.data.qNormalMult;
    }
    if (validated.data.qHighMult !== undefined) {
      updates.q_high_mult = validated.data.qHighMult;
    }
    if (validated.data.maxFileMb !== undefined) {
      updates.max_file_mb = validated.data.maxFileMb;
    }
    if (validated.data.orderExpiryMinutes !== undefined) {
      updates.order_expiry_minutes = validated.data.orderExpiryMinutes;
    }
    if (validated.data.acceptingOrders !== undefined) {
      updates.accepting_orders = validated.data.acceptingOrders;
    }

    try {
      const admin = createAdminClient();
      const { data: updated, error } = await admin
        .from("shops")
        .update(updates)
        .eq("id", shop.id)
        .select()
        .single();

      if (error) {
        throw AppError.internal("Failed to update shop configuration");
      }

      return NextResponse.json({
        shop: updated || { ...shop, ...updates },
      });
    } catch (dbErr) {
      if (dbErr instanceof AppError) throw dbErr;
      // In dev fallback mode
      return NextResponse.json({
        shop: {
          ...shop,
          ...updates,
        },
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
