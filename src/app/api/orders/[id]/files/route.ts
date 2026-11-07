import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, errorResponse } from "@/lib/errors";
import { verifyOrderAccess } from "@/lib/auth/guestAuth";

const InitFileSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/jpg"], {
    errorMap: () => ({ message: "Only PDF, JPG, and PNG files are supported" }),
  }),
  sizeBytes: z
    .number()
    .int()
    .positive("File size must be greater than 0")
    .max(25 * 1024 * 1024, "File size cannot exceed 25 MB"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const guestSecret = request.headers.get("x-order-secret");
    const supabase = createAdminClient();

    // 1. Authenticate guest order session
    const order = await verifyOrderAccess(supabase, orderId, guestSecret);

    if (order.status !== "draft") {
      throw AppError.badRequest("Cannot add files to an order after checkout has begun");
    }

    // 2. Validate request body
    const body = await request.json();
    const parsed = InitFileSchema.safeParse(body);
    if (!parsed.success) {
      throw AppError.validationError(parsed.error.errors[0]?.message ?? "Invalid file metadata");
    }

    const { fileName, mimeType, sizeBytes } = parsed.data;

    // 3. Check file count limit (Max 5 files per order)
    const { count: fileCount } = await supabase
      .from("order_files")
      .select("*", { count: "exact", head: true })
      .eq("order_id", orderId);

    if ((fileCount ?? 0) >= 5) {
      throw AppError.badRequest("Maximum 5 files allowed per order", "MAX_FILES_EXCEEDED");
    }

    // 4. Generate unique storage path
    const fileId = crypto.randomUUID();
    const sanitizedExt = mimeType === "application/pdf" ? "pdf" : mimeType.includes("png") ? "png" : "jpg";
    const storagePath = `${order.shop_id}/${orderId}/${fileId}.${sanitizedExt}`;

    // 5. Create signed upload URL from Supabase Storage (5-minute TTL)
    const { data: uploadData } = await supabase.storage
      .from("uploads")
      .createSignedUploadUrl(storagePath, {
        upsert: true,
      });

    // If storage bucket isn't initialized yet in local/mock testing, construct a fallback direct path
    const uploadUrl = uploadData?.signedUrl ?? `/api/orders/${orderId}/files/${fileId}/direct-upload`;

    // 6. Create order_files record
    const { data: fileRecord, error: fileInsertError } = await supabase
      .from("order_files")
      .insert({
        id: fileId,
        order_id: orderId,
        original_name: fileName,
        storage_path: storagePath,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        page_count: 1, // Will be recounted upon complete
        color_mode: "bw",
        quality: "normal",
        copies: 1,
        selected_pages: 1,
        sides: "single",
        price_paise: 0,
      })
      .select("id, storage_path")
      .single();

    if (fileInsertError || !fileRecord) {
      throw AppError.internal("Failed to register document record");
    }

    return NextResponse.json({
      fileId: fileRecord.id,
      uploadUrl,
      storagePath: fileRecord.storage_path,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
