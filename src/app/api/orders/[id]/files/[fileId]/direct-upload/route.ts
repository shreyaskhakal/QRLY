import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, errorResponse } from "@/lib/errors";
import { verifyOrderAccess } from "@/lib/auth/guestAuth";

export async function PUT(
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
      throw AppError.badRequest("Cannot upload files after checkout has begun");
    }

    // 2. Fetch file record to retrieve storage_path
    const { data: fileRecord, error: fileFetchError } = await supabase
      .from("order_files")
      .select("storage_path, mime_type")
      .eq("id", fileId)
      .eq("order_id", orderId)
      .single();

    if (fileFetchError || !fileRecord || !fileRecord.storage_path) {
      throw AppError.notFound("File registration not found");
    }

    // 3. Read body buffer
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      throw AppError.badRequest("Uploaded file is empty (0 bytes)", "EMPTY_FILE");
    }

    if (buffer.length > 25 * 1024 * 1024) {
      throw AppError.badRequest("File exceeds 25 MB limit", "FILE_TOO_LARGE");
    }

    // 4. Save into Supabase storage
    const { error: storageError } = await supabase.storage
      .from("uploads")
      .upload(fileRecord.storage_path, buffer, {
        contentType: fileRecord.mime_type,
        upsert: true,
      });

    if (storageError) {
      throw AppError.internal(`Storage upload failed: ${storageError.message}`);
    }

    return NextResponse.json({
      success: true,
      bytesReceived: buffer.length,
      storagePath: fileRecord.storage_path,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

