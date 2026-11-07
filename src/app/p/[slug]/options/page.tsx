"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Minus, Plus } from "lucide-react";
import { OptionToggleCard } from "@/components/customer/OptionToggleCard";
import { PageRangeInput } from "@/components/customer/PageRangeInput";
import { StickyPayBar } from "@/components/customer/StickyPayBar";
import { LanguageToggle } from "@/components/customer/LanguageToggle";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { ColorMode, PrintQuality, PageSides } from "@/lib/types";

interface FileOptionState {
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

export default function CustomerOptionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { t } = useLanguage();

  const [orderId, setOrderId] = useState<string | null>(null);
  const [guestSecret, setGuestSecret] = useState<string | null>(null);
  const [files, setFiles] = useState<FileOptionState[]>([]);
  const [orderTotalPaise, setOrderTotalPaise] = useState(0);
  const [bwPricePaise, setBwPricePaise] = useState(200);
  const [colorPricePaise, setColorPricePaise] = useState(1000);
  const [loading, setLoading] = useState(true);
  const [savingFileId, setSavingFileId] = useState<string | null>(null);

  // 1. Fetch shop rates and order data
  useEffect(() => {
    async function init() {
      const savedOrderId = localStorage.getItem(`qrly_${slug}_order_id`);
      const savedSecret = localStorage.getItem(`qrly_${slug}_guest_secret`);

      if (!savedOrderId || !savedSecret) {
        router.push(`/p/${slug}`);
        return;
      }

      setOrderId(savedOrderId);
      setGuestSecret(savedSecret);

      try {
        // Fetch shop rates
        const shopRes = await fetch(`/api/shops/${slug}`);
        if (shopRes.ok) {
          const shopData = await shopRes.json();
          setBwPricePaise(shopData.shop.bwPricePaise || 200);
          setColorPricePaise(shopData.shop.colorPricePaise || 1000);
        }

        // Fetch order files
        const orderRes = await fetch(`/api/orders/${savedOrderId}`, {
          headers: { "x-order-secret": savedSecret },
        });

        if (!orderRes.ok) {
          throw new Error("Could not load order");
        }

        const orderData = await orderRes.json();
        setFiles(orderData.order.files || []);
        setOrderTotalPaise(orderData.order.totalPaise || 0);
      } catch {
        router.push(`/p/${slug}`);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [slug, router]);

  // 2. Update options for a specific file on server
  async function updateFileOption(
    fileId: string,
    updates: Partial<FileOptionState>
  ) {
    if (!orderId || !guestSecret) return;

    // Optimistic state update
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, ...updates } : f))
    );

    const currentFile = files.find((f) => f.id === fileId);
    if (!currentFile) return;

    const merged = { ...currentFile, ...updates };
    setSavingFileId(fileId);

    try {
      const res = await fetch(`/api/orders/${orderId}/files/${fileId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-order-secret": guestSecret,
        },
        body: JSON.stringify({
          colorMode: merged.colorMode,
          quality: merged.quality,
          copies: merged.copies,
          pageRange: merged.pageRange,
          sides: merged.sides,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  pricePaise: data.file.price_paise,
                  selectedPages: data.file.selected_pages,
                }
              : f
          )
        );
        setOrderTotalPaise(data.orderTotalPaise);
      }
    } catch {
      // Revert if failed
    } finally {
      setSavingFileId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col justify-between pb-24 sm:pb-8">
      <div className="p-4 sm:p-6 space-y-6">
        {/* Navigation Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/p/${slug}`)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              aria-label={t.common.back}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{t.options.headerTitle}</h1>
              <p className="text-xs text-slate-500">{t.options.headerSubtitle}</p>
            </div>
          </div>
          <LanguageToggle />
        </div>

        {/* Per-File Option Cards */}
        <div className="space-y-6">
          {files.map((file, idx) => (
            <div
              key={file.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4"
            >
              {/* File Title and Live Subtotal */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-sm text-slate-800" title={file.originalName}>
                      {file.originalName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      File #{idx + 1} · {file.pageCount} {file.pageCount === 1 ? "page" : "pages"}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-slate-900">
                    Rs {(file.pricePaise / 100).toFixed(2)}
                  </span>
                  {savingFileId === file.id && (
                    <p className="text-[10px] text-blue-600 animate-pulse">{t.options.saving}</p>
                  )}
                </div>
              </div>

              {/* Option 1: Color Mode */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t.options.colorMode}
                </label>
                <OptionToggleCard
                  selectedMode={file.colorMode}
                  bwRatePaise={bwPricePaise}
                  colorRatePaise={colorPricePaise}
                  onChange={(mode) => updateFileOption(file.id, { colorMode: mode })}
                />
              </div>

              {/* Option 2: Quality */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Print Quality
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["draft", "normal", "high"] as PrintQuality[]).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => updateFileOption(file.id, { quality: q })}
                      className={`h-10 rounded-xl border text-xs font-medium capitalize transition-all ${
                        file.quality === q
                          ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {q === "high" ? "High (1.5x)" : q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Option 3: Copies Stepper */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div>
                  <span className="text-sm font-semibold text-slate-800">{t.options.copies}</span>
                  <p className="text-[11px] text-slate-500">1 - 50</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateFileOption(file.id, {
                        copies: Math.max(1, file.copies - 1),
                      })
                    }
                    disabled={file.copies <= 1}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 disabled:opacity-40"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center font-bold text-sm text-slate-900">
                    {file.copies}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateFileOption(file.id, {
                        copies: Math.min(50, file.copies + 1),
                      })
                    }
                    disabled={file.copies >= 50}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Option 4: Page Range Selection */}
              <div className="border-t border-slate-100 pt-3 space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t.options.pageRange}
                </label>
                <PageRangeInput
                  totalPages={file.pageCount}
                  initialRange={file.pageRange}
                  onChange={(range) =>
                    updateFileOption(file.id, { pageRange: range })
                  }
                />
              </div>

              {/* Option 5: Sides (Single vs Double) */}
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-slate-800">{t.options.sides}</span>
                  <p className="text-[11px] text-slate-500">{file.sides === "double" ? t.options.doubleSided : t.options.singleSided}</p>
                </div>
                <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => updateFileOption(file.id, { sides: "single" })}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      file.sides === "single"
                        ? "bg-white text-slate-900 shadow-xs font-semibold"
                        : "text-slate-500"
                    }`}
                  >
                    {t.options.singleSided}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateFileOption(file.id, { sides: "double" })}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      file.sides === "double"
                        ? "bg-white text-slate-900 shadow-xs font-semibold"
                        : "text-slate-500"
                    }`}
                  >
                    {t.options.doubleSided}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Bottom Review Bar */}
      <StickyPayBar
        totalPaise={orderTotalPaise}
        buttonLabel={t.options.reviewAndPay}
        onClick={() => router.push(`/p/${slug}/review`)}
        isLoading={Boolean(savingFileId)}
      />
    </div>
  );
}

