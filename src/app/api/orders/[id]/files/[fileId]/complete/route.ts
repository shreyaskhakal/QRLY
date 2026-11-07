import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, errorResponse } from "@/lib/errors";
import { verifyOrderAccess } from "@/lib/auth/guestAuth";
import { validateMagicBytes } from "@/lib/validation/fileValidation";
import { inspectPdfBuffer } from "@/lib/validation/pdfInspector";
import { calculatePrice, calculateOrderTotal } from "@/lib/pricing/calculatePrice";
import type { Shop } from "@/lib/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const { id: orderId, fileId } = await params;
    const guestSecret = request.headers.get("x-order-secret");
    const supabase = createAdminClient();

    // 1. Authenticate guest order session
    const order = await verifyOrderAccess(supabase, orderId, guestSecret);

    if (order.status !== "draft") {
      throw AppError.badRequest("Cannot modify order files after checkout has begun");
    }

    // 2. Fetch order file record
    const { data: fileRecord, error: fileFetchError } = await supabase
      .from("order_files")
      .select("*")
      .eq("id", fileId)
      .eq("order_id", orderId)
      .single();

    if (fileFetchError || !fileRecord || !fileRecord.storage_path) {
      throw AppError.notFound("File record not found");
    }

    // 3. Download uploaded file binary from Supabase Storage
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("uploads")
      .download(fileRecord.storage_path);

    if (downloadError || !fileBlob) {
      throw AppError.badRequest(
        "Uploaded file object could not be retrieved from storage. Please re-upload.",
        "STORAGE_DOWNLOAD_FAILED"
      );
    }

    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. Authoritative Magic Bytes Inspection
    const magicCheck = validateMagicBytes(buffer, fileRecord.mime_type);
    if (!magicCheck.valid) {
      // Purge invalid file
      await supabase.storage.from("uploads").remove([fileRecord.storage_path]);
      await supabase.from("order_files").delete().eq("id", fileId);
      throw AppError.badRequest(magicCheck.error ?? "Invalid file format", "INVALID_FILE_TYPE");
    }

    // 5. Authoritative Page Counting
    let authoritativePageCount = 1;
    if (fileRecord.mime_type === "application/pdf") {
      const pdfInspection = await inspectPdfBuffer(buffer);
      authoritativePageCount = pdfInspection.pageCount;
    } else {
      authoritativePageCount = 1; // Images are 1 page
    }

    // 6. Check order-wide page limit constraint (Max 100 pages per order)
    const { data: siblingFiles } = await supabase
      .from("order_files")
      .select("id, page_count")
      .eq("order_id", orderId)
      .neq("id", fileId);

    const siblingPagesSum = (siblingFiles ?? []).reduce((acc, f) => acc + (f.page_count || 1), 0);
    const newTotalPages = siblingPagesSum + authoritativePageCount;

    if (newTotalPages > 100) {
      await supabase.storage.from("uploads").remove([fileRecord.storage_path]);
      await supabase.from("order_files").delete().eq("id", fileId);
      throw AppError.badRequest(
        `Order exceeds maximum allowed 100 pages (attempted: ${newTotalPages} pages).`,
        "PAGE_LIMIT_EXCEEDED"
      );
    }

    // 7. Fetch shop pricing rules
    const { data: shop } = await supabase
      .from("shops")
      .select("*")
      .eq("id", order.shop_id)
      .single();

    if (!shop) {
      throw AppError.notFound("Associated shop not found");
    }

    // 8. Calculate initial price for the file
    const priceResult = calculatePrice(
      {
        selectedPages: authoritativePageCount,
        copies: 1,
        colorMode: fileRecord.color_mode || "bw",
        quality: fileRecord.quality || "normal",
      },
      shop as Shop
    );

    // 9. Update order_files with verified page count & price
    const { data: updatedFile, error: updateError } = await supabase
      .from("order_files")
      .update({
        page_count: authoritativePageCount,
        selected_pages: authoritativePageCount,
        price_paise: priceResult.pricePaise,
        size_bytes: buffer.length,
      })
      .eq("id", fileId)
      .select()
      .single();

    if (updateError || !updatedFile) {
      throw AppError.internal("Failed to update verified file record");
    }

    // 10. Recalculate and update order total
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

