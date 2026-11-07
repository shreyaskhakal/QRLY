import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateAgent } from "@/lib/auth/agentAuth";
import { AppError, errorResponse } from "@/lib/errors";

const UpdateJobStatusSchema = z.object({
  status: z.enum(["printing", "done", "failed"]),
  localFileDeleted: z.boolean().optional(),
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    const shop = await authenticateAgent(request);
    const supabase = createAdminClient();

    const body = await request.json();
    const parsed = UpdateJobStatusSchema.safeParse(body);
    if (!parsed.success) {
      throw AppError.validationError("Invalid status payload");
    }

    const { status, localFileDeleted, errorCode, errorMessage } = parsed.data;
    const now = new Date().toISOString();

    // 1. Fetch job to verify shop ownership
    const { data: job, error: jobFetchError } = await supabase
      .from("print_jobs")
      .select("id, order_id, order_file_id, shop_id")
      .eq("id", jobId)
      .eq("shop_id", shop.id)
      .single();

    if (jobFetchError || !job) {
      throw AppError.notFound("Print job not found for this shop");
    }

    // 2. State: 'printing'
    if (status === "printing") {
      await supabase
        .from("print_jobs")
        .update({
          status: "printing",
          started_at: now,
          updated_at: now,
        })
        .eq("id", jobId);

      await supabase
        .from("orders")
        .update({
          status: "printing",
          updated_at: now,
        })
        .eq("id", job.order_id);

      return NextResponse.json({ success: true, status: "printing" });
    }

    // 3. State: 'done' (Includes verified deletion protocol)
    if (status === "done") {
      const agentDeletedAt = localFileDeleted ? now : null;

      // Update job
      await supabase
        .from("print_jobs")
        .update({
          status: "done",
          finished_at: now,
          agent_local_deleted_at: agentDeletedAt,
          updated_at: now,
        })
        .eq("id", jobId);

      // Perform server-side storage deletion and verification
      const { data: file } = await supabase
        .from("order_files")
        .select("id, storage_path")
        .eq("id", job.order_file_id)
        .single();

      if (file?.storage_path) {
        // Delete from private storage bucket
        await supabase.storage.from("uploads").remove([file.storage_path]);

        // Mark file verified deleted
        await supabase
          .from("order_files")
          .update({
            deleted_at: now,
            delete_verified: true,
          })
          .eq("id", file.id);
      }

      // Check if all files in the order are now verified deleted
      const { data: siblingFiles } = await supabase
        .from("order_files")
        .select("delete_verified")
        .eq("order_id", job.order_id);

      const allFilesVerified =
        (siblingFiles ?? []).length > 0 &&
        (siblingFiles ?? []).every((f) => f.delete_verified === true);

      // If all files verified and agent reported local deletion, update order
      if (allFilesVerified && localFileDeleted) {
        await supabase
          .from("orders")
          .update({
            status: "done",
            files_deleted_at: now,
            updated_at: now,
          })
          .eq("id", job.order_id);
      } else {
        await supabase
          .from("orders")
          .update({
            status: "done",
            updated_at: now,
          })
          .eq("id", job.order_id);
      }

      return NextResponse.json({
        success: true,
        status: "done",
        filesDeleted: {
          at: allFilesVerified ? now : null,
          verified: allFilesVerified && Boolean(localFileDeleted),
        },
      });
    }

    // 4. State: 'failed'
    if (status === "failed") {
      await supabase
        .from("print_jobs")
        .update({
          status: "failed",
          finished_at: now,
          error_code: errorCode || "PRINT_FAILED",
          error_message: errorMessage || "Unknown printer failure",
          updated_at: now,
        })
        .eq("id", jobId);

      await supabase
        .from("orders")
        .update({
          status: "failed",
          updated_at: now,
        })
        .eq("id", job.order_id);

      return NextResponse.json({ success: true, status: "failed" });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}

