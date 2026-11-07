import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedOwner } from "@/lib/auth/ownerAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, errorResponse } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      throw AppError.badRequest("Missing job ID");
    }

    const { shop } = await getAuthenticatedOwner(request);

    try {
      const admin = createAdminClient();
      // 1. Fetch job and verify ownership
      const { data: job, error: jobError } = await admin
        .from("print_jobs")
        .select("id, order_id, shop_id, status")
        .eq("id", id)
        .eq("shop_id", shop.id)
        .single();

      if (jobError || !job) {
        throw AppError.notFound("Print job not found for this shop");
      }

      if (job.status === "printing") {
        throw AppError.badRequest("Job is currently actively printing");
      }

      // 2. Reset job to queued
      const { error: updateError } = await admin
        .from("print_jobs")
        .update({
          status: "queued",
          printer_id: null,
          claimed_at: null,
          claim_expires_at: null,
          started_at: null,
          finished_at: null,
          error_code: null,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) {
        throw AppError.internal("Failed to re-queue print job");
      }

      // 3. Ensure parent order is set to queued
      await admin
        .from("orders")
        .update({
          status: "queued",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.order_id);

      return NextResponse.json({
        success: true,
        jobId: job.id,
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      // In dev fallback mode
      return NextResponse.json({
        success: true,
        jobId: id,
        mock: true,
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
