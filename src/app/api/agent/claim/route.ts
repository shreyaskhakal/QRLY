import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateAgent } from "@/lib/auth/agentAuth";
import { errorResponse } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate print agent
    const shop = await authenticateAgent(request);
    const supabase = createAdminClient();

    // 2. Fetch printer associated with this shop
    const { data: printer } = await supabase
      .from("printers")
      .select("id, status")
      .eq("shop_id", shop.id)
      .limit(1)
      .maybeSingle();

    const printerId = printer?.id || null;

    // 3. Atomically claim next job
    let claimedJob: any = null;

    try {
      // Use claim_next_job stored procedure
      const { data: rpcJob, error: rpcError } = await supabase.rpc(
        "claim_next_job",
        {
          p_shop: shop.id,
          p_printer: printerId,
          p_lease_seconds: 120,
        }
      );

      if (!rpcError && rpcJob && rpcJob.length > 0) {
        claimedJob = rpcJob[0];
      }
    } catch {
      // Fallback query if RPC unavailable
    }

    if (!claimedJob) {
      // Fallback direct query
      const now = new Date().toISOString();
      const leaseExpires = new Date(Date.now() + 120 * 1000).toISOString();

      const { data: eligibleJobs } = await supabase
        .from("print_jobs")
        .select("*")
        .eq("shop_id", shop.id)
        .or(`status.eq.queued,and(status.eq.claimed,claim_expires_at.lt.${now})`)
        .order("created_at", { ascending: true })
        .limit(1);

      if (eligibleJobs && eligibleJobs.length > 0) {
        const candidate = eligibleJobs[0];
        const { data: updated } = await supabase
          .from("print_jobs")
          .update({
            status: "claimed",
            printer_id: printerId,
            claimed_at: now,
            claim_expires_at: leaseExpires,
            attempts: (candidate.attempts || 0) + 1,
            updated_at: now,
          })
          .eq("id", candidate.id)
          .select()
          .single();

        claimedJob = updated;
      }
    }

    // 4. Return 204 No Content if no jobs queued
    if (!claimedJob) {
      return new NextResponse(null, { status: 204 });
    }

    // 5. Fetch associated file and order metadata
    const { data: file } = await supabase
      .from("order_files")
      .select("*")
      .eq("id", claimedJob.order_file_id)
      .single();

    const { data: order } = await supabase
      .from("orders")
      .select("token_label")
      .eq("id", claimedJob.order_id)
      .single();

    // 6. Generate 5-minute signed download URL
    let downloadUrl: string = `/api/agent/files/${file?.id}/download`;

    if (file?.storage_path) {
      const { data: signedData } = await supabase.storage
        .from("uploads")
        .createSignedUrl(file.storage_path, 300); // 300 seconds = 5 minutes

      if (signedData?.signedUrl) {
        downloadUrl = signedData.signedUrl;
      }
    }

    return NextResponse.json({
      job: {
        id: claimedJob.id,
        orderId: claimedJob.order_id,
        tokenLabel: order?.token_label || "A-001",
        downloadUrl,
        storagePath: file?.storage_path || null,
        options: {
          colorMode: file?.color_mode || "bw",
          quality: file?.quality || "normal",
          copies: file?.copies || 1,
          pageRange: file?.page_range || null,
          sides: file?.sides || "single",
        },
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

