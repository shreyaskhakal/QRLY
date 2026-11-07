"use client";

import React, { useState, useEffect, use } from "react";
import { CheckCircle2, Clock, Printer, ShieldCheck, AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { OrderStatus } from "@/lib/types";

interface OrderDetail {
  id: string;
  shopName: string;
  shopSlug: string;
  tokenLabel: string | null;
  status: OrderStatus;
  totalPaise: number;
  queuePosition: number;
  filesDeleted: {
    at: string | null;
    verified: boolean;
  };
  files: Array<{
    id: string;
    originalName: string;
    selectedPages: number;
    copies: number;
    colorMode: string;
    pricePaise: number;
  }>;
}

export default function OrderStatusPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Poll for real-time status updates every 3 seconds
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    async function fetchStatus() {
      try {
        const guestSecret = localStorage.getItem(`qrly_order_secret_${orderId}`) || undefined;
        const headers: Record<string, string> = {};
        if (guestSecret) {
          headers["x-order-secret"] = guestSecret;
        }

        const res = await fetch(`/api/orders/${orderId}`, { headers });
        if (!res.ok) {
          throw new Error("Could not find order");
        }

        const data = await res.json();
        setOrder(data.order);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error loading status");
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
    intervalId = setInterval(fetchStatus, 3000);

    return () => clearInterval(intervalId);
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
          <p className="text-sm text-slate-500 font-medium">Tracking order status...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-rose-500 mb-2" />
        <h1 className="text-base font-bold text-slate-800">Order Not Found</h1>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          The requested print order could not be located or has expired.
        </p>
      </div>
    );
  }

  const isAwaitingPayment = order.status === "awaiting_payment" || order.status === "draft";
  const isPaid = order.status === "paid";
  const isQueued = order.status === "queued";
  const isPrinting = order.status === "printing";
  const isDone = order.status === "done";
  const isFailed = order.status === "failed";

  const totalRs = (order.totalPaise / 100).toFixed(2);
  const deletionTime = order.filesDeleted.at
    ? new Date(order.filesDeleted.at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="flex min-h-screen flex-col justify-between p-4 sm:p-6 space-y-6">
      <div className="space-y-6 pt-2">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h1 className="text-base font-bold text-slate-900">{order.shopName}</h1>
            <p className="text-[11px] text-slate-500">Self-Service Print Kiosk</p>
          </div>
          {order.shopSlug && (
            <Link
              href={`/p/${order.shopSlug}`}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              New Order
            </Link>
          )}
        </div>

        {/* Token Card */}
        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-6 text-center shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Your Order Token
          </p>
          <div className="my-2">
            <span className="text-4xl font-black tracking-tight text-blue-900">
              {order.tokenLabel ?? "TOKEN PENDING"}
            </span>
          </div>
          <p className="text-xs text-blue-700">
            {isDone
              ? "🎉 Collect your printed pages from the output tray"
              : isPrinting
              ? "🖨️ Pages are printing now at the kiosk"
              : isQueued
              ? `Position ${order.queuePosition} in queue`
              : isAwaitingPayment
              ? "Complete UPI payment to begin printing"
              : "Status: " + order.status}
          </p>
        </div>

        {/* Progress Stepper */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
            Live Print Progress
          </h2>

          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            {/* Step 1: Paid */}
            <div className="space-y-1.5">
              <div
                className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                  isPaid || isQueued || isPrinting || isDone
                    ? "bg-emerald-600 text-white"
                    : isAwaitingPayment
                    ? "bg-blue-600 text-white animate-pulse"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <span className="font-semibold text-[11px] text-slate-700">Paid</span>
            </div>

            {/* Step 2: In Queue */}
            <div className="space-y-1.5">
              <div
                className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                  isQueued || isPrinting || isDone
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                <Clock className="h-5 w-5" />
              </div>
              <span className="font-semibold text-[11px] text-slate-700">In Queue</span>
            </div>

            {/* Step 3: Printing */}
            <div className="space-y-1.5">
              <div
                className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                  isPrinting
                    ? "bg-blue-600 text-white animate-bounce"
                    : isDone
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                <Printer className="h-5 w-5" />
              </div>
              <span className="font-semibold text-[11px] text-slate-700">Printing</span>
            </div>

            {/* Step 4: Done */}
            <div className="space-y-1.5">
              <div
                className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                  isDone
                    ? "bg-emerald-600 text-white ring-4 ring-emerald-100"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <span className="font-semibold text-[11px] text-slate-700">Done</span>
            </div>
          </div>
        </div>

        {/* Verified Deletion Card (Sections 7 & 13.2) */}
        {isDone && (
          <div>
            {order.filesDeleted.verified ? (
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 space-y-1.5 shadow-xs">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span>Your files have been deleted from our servers</span>
                </div>
                <p className="text-xs text-emerald-800">
                  Confirmed deleted at {deletionTime || "just now"}. We keep only your order number and the amount paid.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-transparent" />
                <p className="text-xs text-slate-600 font-medium">
                  Printing done. Deleting your files from our servers...
                </p>
              </div>
            )}
          </div>
        )}

        {/* Failed Alert */}
        {isFailed && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 space-y-2 text-rose-900">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              <span>We could not print this order</span>
            </div>
            <p className="text-xs text-rose-700 leading-relaxed">
              A printer issue occurred. The shop counter has been notified. You can request a reprint or instant refund at the desk using Token <strong>{order.tokenLabel}</strong>.
            </p>
          </div>
        )}

        {/* Order Details Accordion */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Order Receipt
            </span>
            <span className="text-xs font-bold text-slate-900">Rs {totalRs}</span>
          </div>

          <div className="space-y-2">
            {order.files.map((file) => (
              <div key={file.id} className="flex justify-between text-xs text-slate-600">
                <span className="truncate max-w-[200px]">{file.originalName}</span>
                <span>
                  {file.copies}x · {file.selectedPages}p · Rs {(file.pricePaise / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-[11px] text-slate-400 py-2">
        Bookmark this page to check order status anytime: /o/{order.id.substring(0, 8)}...
      </footer>
    </div>
  );
}
