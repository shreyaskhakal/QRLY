import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      throw AppError.badRequest("Missing shop slug");
    }

    const supabase = createAdminClient();

    // 1. Fetch shop profile
    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("*")
      .eq("slug", slug)
      .single();

    if (shopError || !shop) {
      throw AppError.notFound(`Print shop '${slug}' not found`);
    }

    // 2. Fetch printer status
    const { data: printer } = await supabase
      .from("printers")
      .select("status, last_seen_at, supports_color, supports_duplex")
      .eq("shop_id", shop.id)
      .limit(1)
      .maybeSingle();

    // Calculate live online status (heartbeat within 45 seconds)
    let effectivePrinterStatus: "online" | "offline" | "error" = "offline";
    if (printer) {
      if (printer.status === "error") {
        effectivePrinterStatus = "error";
      } else if (printer.last_seen_at) {
        const lastSeen = new Date(printer.last_seen_at).getTime();
        const now = Date.now();
        // 45-second heartbeat threshold
        if (now - lastSeen <= 45000 && printer.status === "online") {
          effectivePrinterStatus = "online";
        }
      }
    }

    // 3. Count active queue jobs
    const { count: queueCount } = await supabase
      .from("print_jobs")
      .select("*", { count: "exact", head: true })
      .eq("shop_id", shop.id)
      .in("status", ["queued", "claimed", "printing"]);

    return NextResponse.json({
      shop: {
        id: shop.id,
        name: shop.name,
        slug: shop.slug,
        bwPricePaise: shop.bw_price_paise,
        colorPricePaise: shop.color_price_paise,
        qDraftMult: Number(shop.q_draft_mult),
        qNormalMult: Number(shop.q_normal_mult),
        qHighMult: Number(shop.q_high_mult),
        maxFileMb: shop.max_file_mb,
        acceptingOrders: Boolean(shop.accepting_orders),
        printerStatus: effectivePrinterStatus,
        activeQueueLength: queueCount ?? 0,
        supportsColor: printer ? Boolean(printer.supports_color) : true,
        supportsDuplex: printer ? Boolean(printer.supports_duplex) : true,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

