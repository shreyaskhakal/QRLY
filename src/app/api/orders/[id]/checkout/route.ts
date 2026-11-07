import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, errorResponse } from "@/lib/errors";
import { verifyOrderAccess } from "@/lib/auth/guestAuth";
import { calculateOrderTotal } from "@/lib/pricing/calculatePrice";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const guestSecret = request.headers.get("x-order-secret");
    const supabase = createAdminClient();

    // 1. Authenticate guest session
    const order = await verifyOrderAccess(supabase, orderId, guestSecret);

    if (order.status !== "draft") {
      throw AppError.badRequest(`Order is already in '${order.status}' state`);
    }

    // 2. Re-check printer status & shop accepting orders
    const { data: shop } = await supabase
      .from("shops")
      .select("accepting_orders")
      .eq("id", order.shop_id)
      .single();

    if (!shop || !shop.accepting_orders) {
      throw AppError.printerOffline("This print shop is currently paused.");
    }

    const { data: printer } = await supabase
      .from("printers")
      .select("status, last_seen_at")
      .eq("shop_id", order.shop_id)
      .limit(1)
      .maybeSingle();

    if (printer) {
      const isStale =
        !printer.last_seen_at ||
        Date.now() - new Date(printer.last_seen_at).getTime() > 45000;

      if (printer.status === "offline" || printer.status === "error" || isStale) {
        throw AppError.printerOffline();
      }
    }

    // 3. Recalculate order total from scratch from order_files
    const { data: files } = await supabase
      .from("order_files")
      .select("price_paise")
      .eq("order_id", orderId);

    if (!files || files.length === 0) {
      throw AppError.badRequest("Cannot checkout an order with 0 files.");
    }

    const totalPaise = calculateOrderTotal(files.map((f) => f.price_paise));

    // 4. Razorpay order initialization
    const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_placeholder";
    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;

    let razorpayOrderId: string;

    if (razorpaySecret && razorpaySecret !== "placeholderKeySecret") {
      // Real or sandbox Razorpay client
      const Razorpay = (await import("razorpay")).default;
      const razorpay = new Razorpay({
        key_id: razorpayKeyId,
        key_secret: razorpaySecret,
      });

      const rzpOrder = await razorpay.orders.create({
        amount: totalPaise,
        currency: "INR",
        receipt: orderId.substring(0, 40),
        notes: {
          orderId,
          shopId: order.shop_id,
        },
      });
      razorpayOrderId = rzpOrder.id;
    } else {
      // Mock order ID for local test mode
      razorpayOrderId = `order_test_${orderId.substring(0, 14)}`;
    }

    // 5. Update order state to awaiting_payment
    await supabase
      .from("orders")
      .update({
        status: "awaiting_payment",
        total_paise: totalPaise,
        razorpay_order_id: razorpayOrderId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return NextResponse.json({
      orderId,
      razorpayOrderId,
      amountPaise: totalPaise,
      currency: "INR",
      razorpayKeyId,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

