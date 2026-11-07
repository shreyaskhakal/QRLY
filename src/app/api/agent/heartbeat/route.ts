import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateAgent } from "@/lib/auth/agentAuth";
import { AppError, errorResponse } from "@/lib/errors";

const HeartbeatSchema = z.object({
  systemName: z.string().default("ShopPrinter"),
  status: z.enum(["online", "offline", "error"]).default("online"),
  statusDetail: z.string().nullable().optional(),
  supportsColor: z.boolean().default(true),
  supportsDuplex: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate print agent
    const shop = await authenticateAgent(request);

    // 2. Validate heartbeat payload
    const body = await request.json().catch(() => ({}));
    const parsed = HeartbeatSchema.safeParse(body);
    if (!parsed.success) {
      throw AppError.validationError("Invalid heartbeat payload");
    }

    const { systemName, status, statusDetail, supportsColor, supportsDuplex } = parsed.data;
    const supabase = createAdminClient();
    const now = new Date().toISOString();

    // 3. Upsert printer record for this shop
    const { data: existingPrinter } = await supabase
      .from("printers")
      .select("id")
      .eq("shop_id", shop.id)
      .limit(1)
      .maybeSingle();

    if (existingPrinter) {
      await supabase
        .from("printers")
        .update({
          system_name: systemName,
          status,
          status_detail: statusDetail || null,
          supports_color: supportsColor,
          supports_duplex: supportsDuplex,
          last_seen_at: now,
        })
        .eq("id", existingPrinter.id);
    } else {
      await supabase.from("printers").insert({
        shop_id: shop.id,
        system_name: systemName,
        status,
        status_detail: statusDetail || null,
        supports_color: supportsColor,
        supports_duplex: supportsDuplex,
        last_seen_at: now,
      });
    }

    return NextResponse.json({
      acknowledged: true,
      shopId: shop.id,
      serverTime: now,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

