import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAuthenticatedOwner } from "@/lib/auth/ownerAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, errorResponse } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const { shop } = await getAuthenticatedOwner(request);

    // Generate high-entropy 192-bit cryptographic agent key
    const rawKey = `agk_live_${crypto.randomBytes(24).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    try {
      const admin = createAdminClient();
      const { error } = await admin
        .from("shops")
        .update({
          agent_key_hash: keyHash,
          updated_at: new Date().toISOString(),
        })
        .eq("id", shop.id);

      if (error) {
        throw AppError.internal("Failed to update agent key hash");
      }

      return NextResponse.json({
        agentKey: rawKey,
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      // In dev fallback mode
      return NextResponse.json({
        agentKey: rawKey,
        mock: true,
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
