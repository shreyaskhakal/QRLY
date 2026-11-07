import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedOwner } from "@/lib/auth/ownerAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const { shop } = await getAuthenticatedOwner(request);
    let admin: ReturnType<typeof createAdminClient> | null = null;
    try {
      admin = createAdminClient();
    } catch {
      // In dev fallback or offline test mode
    }

    // Today's start in UTC
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    let todayEarningsPaise = 0;
    let todayJobsCount = 0;
    let todayPagesCount = 0;

    // 1. Calculate Today's Earnings
    try {
      if (admin) {
        const { data: paidOrders } = await admin
          .from("orders")
          .select("id, total_paise")
          .eq("shop_id", shop.id)
          .in("status", ["paid", "queued", "printing", "done"])
          .gte("created_at", todayIso);

        if (paidOrders && paidOrders.length > 0) {
          todayEarningsPaise = paidOrders.reduce((sum, ord) => sum + (ord.total_paise || 0), 0);
        }

        // 2. Count Today's Jobs
        const { count: jobCount } = await admin
          .from("print_jobs")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shop.id)
          .gte("created_at", todayIso);

        todayJobsCount = jobCount || 0;

        // 3. Count Today's Pages
        if (paidOrders && paidOrders.length > 0) {
          const orderIds = paidOrders.map((o) => o.id);
          const { data: files } = await admin
            .from("order_files")
            .select("selected_pages, copies")
            .in("order_id", orderIds);

          if (files) {
            todayPagesCount = files.reduce(
              (sum, f) => sum + (f.selected_pages || 1) * (f.copies || 1),
              0
            );
          }
        }
      }
    } catch {
      // In dev fallback mode or if database tables are unpopulated
      todayEarningsPaise = 0;
      todayJobsCount = 0;
      todayPagesCount = 0;
    }

    // 4. Fetch latest printer telemetry
    let printerData = {
      systemName: "Kiosk Printer",
      status: "offline" as "online" | "offline" | "error",
      statusDetail: "Waiting for agent connection",
      lastSeenAt: null as string | null,
      supportsColor: true,
      supportsDuplex: true,
    };

    try {
      if (admin) {
        const { data: printer } = await admin
          .from("printers")
          .select("system_name, status, status_detail, last_seen_at, supports_color, supports_duplex")
          .eq("shop_id", shop.id)
          .order("last_seen_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        if (printer) {
          let effectiveStatus: "online" | "offline" | "error" = "offline";
          if (printer.status === "error") {
            effectiveStatus = "error";
          } else if (printer.last_seen_at) {
            const diffMs = Date.now() - new Date(printer.last_seen_at).getTime();
            if (diffMs <= 45000 && printer.status === "online") {
              effectiveStatus = "online";
            }
          }

          printerData = {
            systemName: printer.system_name || "Kiosk Printer",
            status: effectiveStatus,
            statusDetail: printer.status_detail || "Ready",
            lastSeenAt: printer.last_seen_at,
            supportsColor: printer.supports_color ?? true,
            supportsDuplex: printer.supports_duplex ?? true,
          };
        }
      }
    } catch {
      // Printer fallback
    }

    return NextResponse.json({
      shop: {
        id: shop.id,
        slug: shop.slug,
        name: shop.name,
        acceptingOrders: shop.accepting_orders,
        bwPricePaise: shop.bw_price_paise,
        colorPricePaise: shop.color_price_paise,
        orderExpiryMinutes: shop.order_expiry_minutes,
      },
      todayEarningsPaise,
      todayJobsCount,
      todayPagesCount,
      printer: printerData,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
