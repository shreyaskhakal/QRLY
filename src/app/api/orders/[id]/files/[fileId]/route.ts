import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, errorResponse } from "@/lib/errors";
import { verifyOrderAccess } from "@/lib/auth/guestAuth";
import { parsePageRange } from "@/lib/parser/parsePageRange";
import { calculatePrice, calculateOrderTotal } from "@/lib/pricing/calculatePrice";
import type { Shop } from "@/lib/types";

const UpdateOptionsSchema = z.object({
  colorMode: z.enum(["bw", "color"]),
  quality: z.enum(["draft", "normal", "high"]),
  copies: z.number().int().min(1).max(50),
  pageRange: z.string().nullable().optional(),
  sides: z.enum(["single", "double"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const { id: orderId, fileId } = await params;
    const guestSecret = request.headers.get("x-order-secret");
    const supabase = createAdminClient();

    // 1. Authenticate guest session
    const order = await verifyOrderAccess(supabase, orderId, guestSecret);

    if (order.status !== "draft") {
      throw AppError.badRequest("Cannot alter print options after checkout has begun");
    }

    // 2. Validate input options
    const body = await request.json();
    const parsed = UpdateOptionsSchema.safeParse(body);
    if (!parsed.success) {
      throw AppError.validationError(parsed.error.errors[0]?.message ?? "Invalid print options");
    }

    const { colorMode, quality, copies, pageRange, sides } = parsed.data;

    // 3. Fetch file record to get authoritative page_count
    const { data: fileRecord, error: fileFetchError } = await supabase
      .from("order_files")
      .select("*")
      .eq("id", fileId)
      .eq("order_id", orderId)
      .single();

    if (fileFetchError || !fileRecord) {
      throw AppError.notFound("File not found in order");
    }

    // 4. Validate & parse page range
    const rangeResult = parsePageRange(pageRange, fileRecord.page_count);
    if (!rangeResult.valid) {
      throw AppError.validationError(rangeResult.error ?? "Invalid page range");
    }

    // 5. Fetch shop pricing rules
    const { data: shop } = await supabase
      .from("shops")
      .select("*")
      .eq("id", order.shop_id)
      .single();

    if (!shop) {
      throw AppError.notFound("Associated shop not found");
    }

    // 6. Recalculate price authoritatively
    const priceResult = calculatePrice(
      {
        selectedPages: rangeResult.selectedCount,
        copies,
        colorMode,
        quality,
      },
      shop as Shop
    );

    // 7. Update file record
    const { data: updatedFile, error: fileUpdateError } = await supabase
      .from("order_files")
      .update({
        color_mode: colorMode,
        quality,
        copies,
        page_range: pageRange || null,
        selected_pages: rangeResult.selectedCount,
        sides,
        price_paise: priceResult.pricePaise,
      })
      .eq("id", fileId)
      .select()
      .single();

    if (fileUpdateError || !updatedFile) {
      throw AppError.internal("Failed to save updated print options");
    }

    // 8. Recalculate order total
    const { data: allOrderFiles } = await supabase
      .from("order_files")
      .select("price_paise")
      .eq("order_id", orderId);

    const filePrices = (allOrderFiles ?? []).map((f) => f.price_paise);
    const newOrderTotal = calculateOrderTotal(filePrices);

    await supabase
      .from("orders")
      .update({ total_paise: newOrderTotal, updated_at: new Date().toISOString() })
      .eq("id", orderId);

    return NextResponse.json({
      file: updatedFile,
      orderTotalPaise: newOrderTotal,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const { id: orderId, fileId } = await params;
    const guestSecret = request.headers.get("x-order-secret");
    const supabase = createAdminClient();

    // 1. Authenticate guest session
    const order = await verifyOrderAccess(supabase, orderId, guestSecret);

    if (order.status !== "draft") {
      throw AppError.badRequest("Cannot delete files from an order after checkout has begun");
    }

    // 2. Fetch file to get storage_path
    const { data: fileRecord, error: fileFetchError } = await supabase
      .from("order_files")
      .select("storage_path")
      .eq("id", fileId)
      .eq("order_id", orderId)
      .single();

    if (fileFetchError || !fileRecord) {
      throw AppError.notFound("File not found in order");
    }

    // 3. Delete from Supabase storage if storage_path exists
    if (fileRecord.storage_path) {
      await supabase.storage.from("uploads").remove([fileRecord.storage_path]);
    }

    // 4. Delete order_files row
    await supabase.from("order_files").delete().eq("id", fileId);

    // 5. Recalculate order total
    const { data: remainingFiles } = await supabase
      .from("order_files")
      .select("price_paise")
      .eq("order_id", orderId);

    const filePrices = (remainingFiles ?? []).map((f) => f.price_paise);
    const newOrderTotal = calculateOrderTotal(filePrices);

    await supabase
      .from("orders")
      .update({ total_paise: newOrderTotal, updated_at: new Date().toISOString() })
      .eq("id", orderId);

    return NextResponse.json({
      success: true,
      newTotalPaise: newOrderTotal,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

