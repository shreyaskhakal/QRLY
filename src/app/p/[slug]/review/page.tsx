"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { ArrowLeft, ShieldCheck, FileText, Sparkles } from "lucide-react";
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

      const checkoutData = await res.json();

      // Launch Razorpay Standard Checkout Modal if script loaded
      const rzpWindow = window as unknown as { Razorpay?: any };
      if (typeof window !== "undefined" && rzpWindow.Razorpay) {
        const options = {
          key: checkoutData.razorpayKeyId,
          amount: checkoutData.amountPaise,
          currency: "INR",
          name: shopName,
          description: "QRLY Print Kiosk Order",
          order_id: checkoutData.razorpayOrderId,
          handler: function () {
            // Once customer completes payment, redirect to live status page
            router.push(`/o/${orderId}`);
          },
          modal: {
            ondismiss: function () {
              setPaying(false);
            },
          },
          theme: {
            color: "#2563EB",
          },
        };

        const razorpayInstance = new rzpWindow.Razorpay(options);
        razorpayInstance.on("payment.failed", function (response: any) {
          setErrorMessage(
            response.error?.description || "Payment was declined or cancelled."
          );
          setPaying(false);
        });
        razorpayInstance.open();
      } else {
        // Fallback for development/testing: navigate to status page directly
        router.push(`/o/${orderId}`);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Payment initialization failed");
      setPaying(false);
    }
  }

  // Developer / Test Mode: Trigger Webhook Directly
  async function triggerTestWebhook(simulateSuccess: boolean) {
    if (!orderId || !guestSecret) return;
    setPaying(true);

    try {
      const checkoutRes = await fetch(`/api/orders/${orderId}/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-order-secret": guestSecret,
        },
      });

      const checkoutData = await checkoutRes.json();

      if (simulateSuccess) {
        // Send simulated payment.captured webhook to server
        await fetch("/api/webhooks/razorpay", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            event: "payment.captured",
            event_id: `evt_test_${Date.now()}`,
            payload: {
              payment: {
                entity: {
                  id: `pay_test_${Date.now()}`,
                  order_id: checkoutData.razorpayOrderId,
                  amount: checkoutData.amountPaise,
                  status: "captured",
                  method: "upi",
                },
              },
            },
          }),
        });
      }

      router.push(`/o/${orderId}`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Test payment failed");
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
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />

      <div className="flex min-h-screen flex-col justify-between pb-28 sm:pb-8">
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

          {/* Test Mode Simulator for Sandbox Testing */}
          <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 p-4 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <span>Razorpay Test Sandbox Simulator</span>
            </div>
            <p className="text-[11px] text-indigo-700">
              Test instant UPI payment flows without opening payment gateway:
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => triggerTestWebhook(true)}
                className="flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 active:scale-95 transition-all"
              >
                Simulate Success (UPI)
              </button>
              <button
                type="button"
                onClick={() => triggerTestWebhook(false)}
                className="rounded-xl border border-indigo-300 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 active:scale-95 transition-all"
              >
                Simulate Failure
              </button>
            </div>
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
    </>
  );
}
