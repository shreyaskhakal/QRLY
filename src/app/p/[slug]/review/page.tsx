"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, FileText } from "lucide-react";
import { StickyPayBar } from "@/components/customer/StickyPayBar";
import type { ColorMode, PrintQuality, PageSides } from "@/lib/types";

interface ReviewFileItem {
  id: string;
  originalName: string;
  pageCount: number;
  colorMode: ColorMode;
  quality: PrintQuality;
  copies: number;
  pageRange: string | null;
  selectedPages: number;
  sides: PageSides;
  pricePaise: number;
}

export default function CustomerReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();

  const [orderId, setOrderId] = useState<string | null>(null);
  const [guestSecret, setGuestSecret] = useState<string | null>(null);
  const [files, setFiles] = useState<ReviewFileItem[]>([]);
  const [totalPaise, setTotalPaise] = useState(0);
  const [shopName, setShopName] = useState("Print Kiosk");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrder() {
      const savedOrderId = localStorage.getItem(`qrly_${slug}_order_id`);
      const savedSecret = localStorage.getItem(`qrly_${slug}_guest_secret`);

      if (!savedOrderId || !savedSecret) {
        router.push(`/p/${slug}`);
        return;
      }

      setOrderId(savedOrderId);
      setGuestSecret(savedSecret);

      try {
        const res = await fetch(`/api/orders/${savedOrderId}`, {
          headers: { "x-order-secret": savedSecret },
        });

        if (!res.ok) {
          throw new Error("Could not retrieve order details");
        }

        const data = await res.json();
        setFiles(data.order.files || []);
        setTotalPaise(data.order.totalPaise || 0);
        setShopName(data.order.shopName || "Print Kiosk");
      } catch {
        router.push(`/p/${slug}`);
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [slug, router]);

  async function handleProceedToPay() {
    if (!orderId || !guestSecret) return;
    setPaying(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-order-secret": guestSecret,
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || "Checkout failed");
      }

      // In Phase 2: Checkout transitions to awaiting_payment.
      // Redirect to status page /o/{orderId} to track progress
      router.push(`/o/${orderId}`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Payment initialization failed");
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const totalRs = (totalPaise / 100).toFixed(2);

  return (
    <div className="flex min-h-screen flex-col justify-between pb-24 sm:pb-8">
      <div className="p-4 sm:p-6 space-y-6">
        {/* Navigation Header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(`/p/${slug}/options`)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Review & Pay</h1>
            <p className="text-xs text-slate-500">{shopName}</p>
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {errorMessage}
          </div>
        )}

        {/* Order Summary Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
            Items to Print ({files.length})
          </h2>

          <div className="divide-y divide-slate-100">
            {files.map((file) => {
              const fileTotalRs = (file.pricePaise / 100).toFixed(2);
              const colorLabel = file.colorMode === "color" ? "Color" : "B&W";
              const qualityLabel = file.quality.charAt(0).toUpperCase() + file.quality.slice(1);
              const sidesLabel = file.sides === "double" ? "Double-sided" : "Single-sided";
              const pagesLabel = file.pageRange
                ? `Pages: ${file.pageRange} (${file.selectedPages}p)`
                : `All pages (${file.selectedPages}p)`;

              return (
                <div key={file.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {file.originalName}
                      </p>
                    </div>
                    <span className="font-bold text-sm text-slate-900 shrink-0">
                      Rs {fileTotalRs}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 pl-6">
                    {colorLabel} · {qualityLabel} · {file.copies} {file.copies === 1 ? "copy" : "copies"} · {sidesLabel}
                  </p>
                  <p className="text-xs text-slate-500 pl-6">{pagesLabel}</p>
                </div>
              );
            })}
          </div>

          {/* Pricing Totals */}
          <div className="border-t border-slate-100 pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-slate-500 text-xs">
              <span>Subtotal</span>
              <span>Rs {totalRs}</span>
            </div>
            <div className="flex justify-between text-slate-500 text-xs">
              <span>Payment Gateway Fee</span>
              <span>Rs 0.00 (Free)</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-slate-100">
              <span>Order Total</span>
              <span className="text-blue-600">Rs {totalRs}</span>
            </div>
          </div>
        </div>

        {/* Privacy by Default Promise */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-800 font-semibold text-xs">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Privacy Guaranteed</span>
          </div>
          <p className="text-xs text-emerald-700 leading-relaxed">
            Your uploaded files are encrypted and permanently deleted from all cloud servers immediately after printing is complete.
          </p>
        </div>

        {/* Payment Methods Info */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between text-xs text-slate-600">
          <span>Supported payment:</span>
          <span className="font-semibold text-slate-800">UPI (GPay, PhonePe, Paytm, BHIM)</span>
        </div>
      </div>

      {/* Sticky Bottom Pay Bar */}
      <StickyPayBar
        totalPaise={totalPaise}
        buttonLabel={`Pay Rs ${totalRs}`}
        onClick={handleProceedToPay}
        isLoading={paying}
      />
    </div>
  );
}
