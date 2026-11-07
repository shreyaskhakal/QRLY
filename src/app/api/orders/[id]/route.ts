import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, errorResponse } from "@/lib/errors";
import { hashGuestSecret } from "@/lib/auth/guestAuth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const guestSecret = request.headers.get("x-order-secret");
    const supabase = createAdminClient();

    // 1. Fetch order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, shops(name, slug)")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw AppError.notFound("Order not found");
    }

    // 2. Auth check: If draft, strictly require x-order-secret match
    if (order.status === "draft") {
      if (!guestSecret || hashGuestSecret(guestSecret) !== order.guest_secret_hash) {
        throw AppError.unauthorized("Authentication required to view draft order");
      }
    }

    // 3. Fetch order files
    const { data: files } = await supabase
      .from("order_files")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    // 4. Fetch print jobs if created
    const { data: jobs } = await supabase
      .from("print_jobs")
      .select("*")
      .eq("order_id", orderId);

    // 5. Calculate queue position if order is queued
    let queuePosition = 0;
    if (order.status === "queued" || order.status === "paid") {
      const { count } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("shop_id", order.shop_id)
        .in("status", ["paid", "queued", "printing"])
        .lt("created_at", order.created_at);

      queuePosition = (count ?? 0) + 1;
    }

    // Check verified deletion: all files must have delete_verified = true
    const allFilesDeleted =
      (files ?? []).length > 0 &&
      (files ?? []).every((f) => f.delete_verified === true);

    return NextResponse.json({
      order: {
        id: order.id,
        shopName: (order.shops as { name: string } | null)?.name ?? "Print Shop",
        shopSlug: (order.shops as { slug: string } | null)?.slug ?? "",
        tokenLabel: order.token_label,
        status: order.status,
        totalPaise: order.total_paise,
        queuePosition,
        filesDeleted: {
          at: order.files_deleted_at,
          verified: allFilesDeleted,
        },
        files: (files ?? []).map((f) => ({
          id: f.id,
          originalName: f.original_name,
          pageCount: f.page_count,
          colorMode: f.color_mode,
          quality: f.quality,
          copies: f.copies,
          pageRange: f.page_range,
          selectedPages: f.selected_pages,
          sides: f.sides,
          pricePaise: f.price_paise,
        })),
        jobs: jobs ?? [],
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

