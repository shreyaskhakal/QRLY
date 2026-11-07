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
      // Dev / offline mode
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);
    const date = searchParams.get("date"); // YYYY-MM-DD

    try {
      if (!admin) {
        throw new Error("Supabase admin unavailable in test mode");
      }

      let query = admin
        .from("print_jobs")
        .select(
          `
          id,
          order_id,
          order_file_id,
          status,
          attempts,
          claimed_at,
          started_at,
          finished_at,
          error_code,
          error_message,
          created_at,
          updated_at,
          orders (
            token_label,
            total_paise,
            status,
            paid_at
          ),
          order_files (
            original_name,
            mime_type,
            size_bytes,
            page_count,
            color_mode,
            quality,
            copies,
            page_range,
            selected_pages,
            sides,
            price_paise,
            storage_path,
            delete_verified
          )
        `,
          { count: "exact" }
        )
        .eq("shop_id", shop.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (status !== "all") {
        query = query.eq("status", status);
      }

      if (date) {
        const start = new Date(`${date}T00:00:00Z`).toISOString();
        const end = new Date(`${date}T23:59:59.999Z`).toISOString();
        query = query.gte("created_at", start).lte("created_at", end);
      }

      const { data: rawJobs, count, error } = await query;

      if (error) {
        throw error;
      }

      const jobs = (rawJobs || []).map((job) => {
        // Handle Supabase 1-to-1 or array return shapes
        const orderData = Array.isArray(job.orders) ? job.orders[0] : job.orders;
        const fileData = Array.isArray(job.order_files) ? job.order_files[0] : job.order_files;

        return {
          id: job.id,
          orderId: job.order_id,
          orderFileId: job.order_file_id,
          status: job.status,
          attempts: job.attempts,
          claimedAt: job.claimed_at,
          startedAt: job.started_at,
          finishedAt: job.finished_at,
          errorCode: job.error_code,
          errorMessage: job.error_message,
          createdAt: job.created_at,
          updatedAt: job.updated_at,
          tokenLabel: orderData?.token_label || "—",
          orderTotalPaise: orderData?.total_paise || 0,
          orderStatus: orderData?.status || "unknown",
          file: fileData
            ? {
                originalName: fileData.original_name,
                mimeType: fileData.mime_type,
                pageCount: fileData.page_count,
                colorMode: fileData.color_mode,
                quality: fileData.quality,
                copies: fileData.copies,
                pageRange: fileData.page_range,
                selectedPages: fileData.selected_pages,
                sides: fileData.sides,
                pricePaise: fileData.price_paise,
                storagePath: fileData.storage_path,
                deleteVerified: fileData.delete_verified,
              }
            : null,
        };
      });

      return NextResponse.json({
        jobs,
        totalCount: count || jobs.length,
        limit,
        offset,
      });
    } catch {
      // In dev fallback mode if database is offline
      return NextResponse.json({
        jobs: [],
        totalCount: 0,
        limit,
        offset,
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
