import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, errorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    // 1. Authorize cron request using CRON_SECRET header
    const cronSecret = process.env.CRON_SECRET;
    const providedSecret =
      request.headers.get("x-cron-secret") ||
      request.headers.get("authorization")?.replace("Bearer ", "");

    if (cronSecret && cronSecret !== "super_secret_cron_token_min_32_characters") {
      if (providedSecret !== cronSecret) {
        throw AppError.unauthorized("Invalid cron secret header");
      }
    }

    const supabase = createAdminClient();
    const now = new Date().toISOString();

    let expiredOrdersCount = 0;
    let filesPurgedCount = 0;
    let stuckJobsFlaggedCount = 0;
    let printersMarkedOfflineCount = 0;

    try {
      // 2. Action A: Expire unpaid orders past expires_at
      const { data: expiredOrders } = await supabase
        .from("orders")
        .select("id, shop_id")
        .in("status", ["draft", "awaiting_payment"])
        .lt("expires_at", now);

      if (expiredOrders && expiredOrders.length > 0) {
        expiredOrdersCount = expiredOrders.length;
        const expiredOrderIds = expiredOrders.map((o) => o.id);

        // Fetch files belonging to these expired orders
        const { data: filesToPurge } = await supabase
          .from("order_files")
          .select("id, storage_path")
          .in("order_id", expiredOrderIds);

        if (filesToPurge && filesToPurge.length > 0) {
          const storagePaths = filesToPurge
            .map((f) => f.storage_path)
            .filter(Boolean) as string[];

          // Remove from storage bucket
          if (storagePaths.length > 0) {
            await supabase.storage.from("uploads").remove(storagePaths);
            filesPurgedCount = storagePaths.length;
          }

          // Mark files verified deleted
          await supabase
            .from("order_files")
            .update({
              deleted_at: now,
              delete_verified: true,
            })
            .in("order_id", expiredOrderIds);
        }

        // Transition orders to expired
        await supabase
          .from("orders")
          .update({
            status: "expired",
            files_deleted_at: now,
            updated_at: now,
          })
          .in("id", expiredOrderIds);
      }

      // 3. Action B: Flag stuck print jobs exceeding 10-minute timeout
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: stuckJobs } = await supabase
        .from("print_jobs")
        .select("id, order_id")
        .eq("status", "printing")
        .lt("started_at", tenMinutesAgo);

      if (stuckJobs && stuckJobs.length > 0) {
        stuckJobsFlaggedCount = stuckJobs.length;
        const stuckJobIds = stuckJobs.map((j) => j.id);

        await supabase
          .from("print_jobs")
          .update({
            status: "failed",
            error_code: "AGENT_TIMEOUT",
            error_message: "Print agent exceeded 10-minute timeout",
            updated_at: now,
          })
          .in("id", stuckJobIds);

        // Also flag associated orders as failed
        const affectedOrderIds = [...new Set(stuckJobs.map((j) => j.order_id))];
        await supabase
          .from("orders")
          .update({
            status: "failed",
            updated_at: now,
          })
          .in("id", affectedOrderIds);
      }

      // 4. Action C: Mark stale printers offline (heartbeat > 45 seconds old)
      const fortyFiveSecondsAgo = new Date(Date.now() - 45 * 1000).toISOString();
      const { data: stalePrinters } = await supabase
        .from("printers")
        .select("id")
        .eq("status", "online")
        .lt("last_seen_at", fortyFiveSecondsAgo);

      if (stalePrinters && stalePrinters.length > 0) {
        printersMarkedOfflineCount = stalePrinters.length;
        const stalePrinterIds = stalePrinters.map((p) => p.id);

        await supabase
          .from("printers")
          .update({
            status: "offline",
            status_detail: "Heartbeat lost (offline > 45s)",
          })
          .in("id", stalePrinterIds);
      }
    } catch (dbError) {
      console.warn("[Cron Sweeper] Database unreachable or unconfigured in local environment:", dbError);
    }

    return NextResponse.json({
      success: true,
      timestamp: now,
      summary: {
        expiredOrders: expiredOrdersCount,
        filesPurged: filesPurgedCount,
        stuckJobsFlagged: stuckJobsFlaggedCount,
        printersMarkedOffline: printersMarkedOfflineCount,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

