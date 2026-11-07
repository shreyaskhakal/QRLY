"use client";

import React, { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, AlertCircle, ShieldCheck } from "lucide-react";
import { PrinterStatusBadge } from "@/components/customer/PrinterStatusBadge";
import { FileCard } from "@/components/customer/FileCard";
import { StickyPayBar } from "@/components/customer/StickyPayBar";

interface ShopInfo {
  id: string;
  name: string;
  slug: string;
  bwPricePaise: number;
  colorPricePaise: number;
  maxFileMb: number;
  acceptingOrders: boolean;
  printerStatus: "online" | "offline" | "error";
  activeQueueLength: number;
}

interface UploadedItem {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  pageCount: number;
  isUploading: boolean;
  uploadProgress: number;
  error?: string;
}

export default function CustomerUploadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [guestSecret, setGuestSecret] = useState<string | null>(null);
  const [files, setFiles] = useState<UploadedItem[]>([]);
  const [orderTotalPaise, setOrderTotalPaise] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Fetch shop profile
  useEffect(() => {
    async function loadShop() {
      try {
        const res = await fetch(`/api/shops/${slug}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || "Failed to load shop");
        }
        const data = await res.json();
        setShop(data.shop);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Shop not available");
      } finally {
        setLoading(false);
      }
    }
    loadShop();
  }, [slug]);

  // 2. Load stored session from localStorage if present
  useEffect(() => {
    const savedOrderId = localStorage.getItem(`qrly_${slug}_order_id`);
    const savedSecret = localStorage.getItem(`qrly_${slug}_guest_secret`);
    if (savedOrderId && savedSecret) {
      setOrderId(savedOrderId);
      setGuestSecret(savedSecret);

      // Restore files for this order
      fetch(`/api/orders/${savedOrderId}`, {
        headers: { "x-order-secret": savedSecret },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.order?.files) {
            setFiles(
              data.order.files.map((f: any) => ({
                id: f.id,
                name: f.originalName,
                sizeBytes: 1024 * 1024,
                mimeType: f.originalName.endsWith(".pdf") ? "application/pdf" : "image/jpeg",
                pageCount: f.pageCount,
                isUploading: false,
                uploadProgress: 100,
              }))
            );
            setOrderTotalPaise(data.order.totalPaise || 0);
          }
        })
        .catch(() => {});
    }
  }, [slug]);

  // 3. Create order if not already initialized
  async function ensureOrder(): Promise<{ id: string; secret: string }> {
    if (orderId && guestSecret) {
      return { id: orderId, secret: guestSecret };
    }

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopSlug: slug }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || "Could not start order");
    }

    const data = await res.json();
    setOrderId(data.orderId);
    setGuestSecret(data.guestSecret);
    localStorage.setItem(`qrly_${slug}_order_id`, data.orderId);
    localStorage.setItem(`qrly_${slug}_guest_secret`, data.guestSecret);

    return { id: data.orderId, secret: data.guestSecret };
  }

  // 4. File selection and upload handler
  async function handleFilesSelected(selectedFiles: FileList | null) {
    if (!selectedFiles || selectedFiles.length === 0) return;
    setErrorMessage(null);

    if (files.length + selectedFiles.length > 5) {
      setErrorMessage("Maximum 5 files allowed per order.");
      return;
    }

    try {
      const { id: currentOrderId, secret: currentSecret } = await ensureOrder();

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        if (!file) continue;

        // Validation: size
        if (file.size > 25 * 1024 * 1024) {
          setErrorMessage(`'${file.name}' exceeds the 25 MB size limit.`);
          continue;
        }

        const tempId = crypto.randomUUID();
        const newItem: UploadedItem = {
          id: tempId,
          name: file.name,
          sizeBytes: file.size,
          mimeType: file.type || "application/pdf",
          pageCount: 1,
          isUploading: true,
          uploadProgress: 20,
        };

        setFiles((prev) => [...prev, newItem]);

        // Step 4a: Register file with API
        const initRes = await fetch(`/api/orders/${currentOrderId}/files`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-order-secret": currentSecret,
          },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || "application/pdf",
            sizeBytes: file.size,
          }),
        });

        if (!initRes.ok) {
          const errData = await initRes.json();
          throw new Error(errData.error?.message || "File registration failed");
        }

        const { fileId } = await initRes.json();

        // Step 4b: Upload via direct upload route
        setFiles((prev) =>
          prev.map((f) => (f.id === tempId ? { ...f, id: fileId, uploadProgress: 60 } : f))
        );

        const uploadRes = await fetch(`/api/orders/${currentOrderId}/files/${fileId}/direct-upload`, {
          method: "PUT",
          headers: {
            "x-order-secret": currentSecret,
            "Content-Type": file.type || "application/pdf",
          },
          body: file,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error?.message || "Upload transfer failed");
        }

        // Step 4c: Complete upload and count pages authoritatively
        setFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, uploadProgress: 85 } : f))
        );

        const completeRes = await fetch(`/api/orders/${currentOrderId}/files/${fileId}/complete`, {
          method: "POST",
          headers: {
            "x-order-secret": currentSecret,
          },
        });

        if (!completeRes.ok) {
          const errData = await completeRes.json();
          throw new Error(errData.error?.message || "Verification failed");
        }

        const completeData = await completeRes.json();

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  pageCount: completeData.file.page_count,
                  isUploading: false,
                  uploadProgress: 100,
                }
              : f
          )
        );

        setOrderTotalPaise(completeData.orderTotalPaise);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Upload encountered an error");
    }
  }

  // 5. Delete file handler
  async function handleDeleteFile(fileId: string) {
    if (!orderId || !guestSecret) return;

    try {
      const res = await fetch(`/api/orders/${orderId}/files/${fileId}`, {
        method: "DELETE",
        headers: { "x-order-secret": guestSecret },
      });

      if (res.ok) {
        const data = await res.json();
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
        setOrderTotalPaise(data.newTotalPaise);
      }
    } catch {
      // Error handled silently on optimistic deletion
    }
  }

  const isPrinterOffline = !shop || shop.printerStatus !== "online" || !shop.acceptingOrders;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
          <p className="text-sm text-slate-500 font-medium">Connecting to print kiosk...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col justify-between pb-24 sm:pb-8">
      <div className="p-4 sm:p-6 space-y-5">
        {/* Shop Header */}
        <header className="space-y-2 border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {shop?.name ?? "Print Kiosk"}
            </h1>
          </div>

          {shop && (
            <PrinterStatusBadge
              status={shop.printerStatus}
              activeQueueLength={shop.activeQueueLength}
            />
          )}
        </header>

        {/* Offline / Paused Warning Banner */}
        {isPrinterOffline && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Printer is currently unavailable</p>
                <p className="text-xs text-rose-700 mt-1">
                  This printer is not accepting jobs right now. Please tell the shop staff.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Toast */}
        {errorMessage && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-amber-900 font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Upload Dropzone */}
        {!isPrinterOffline && (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".pdf,image/jpeg,image/png"
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-[140px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-5 text-center transition-colors hover:border-blue-500 hover:bg-blue-50/30 active:scale-[0.99]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 mb-2">
                <UploadCloud className="h-6 w-6" />
              </div>
              <span className="font-semibold text-sm text-slate-900">
                Choose Files to Print
              </span>
              <span className="text-xs text-slate-500 mt-0.5">
                PDF, JPG, PNG (Max 5 files, up to 25 MB each)
              </span>
            </button>
          </div>
        )}

        {/* Uploaded Document List */}
        {files.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Uploaded Documents ({files.length}/5)
            </h2>
            <div className="space-y-2.5">
              {files.map((file) => (
                <FileCard
                  key={file.id}
                  name={file.name}
                  sizeBytes={file.sizeBytes}
                  mimeType={file.mimeType}
                  pageCount={file.pageCount}
                  isUploading={file.isUploading}
                  uploadProgress={file.uploadProgress}
                  onDelete={() => handleDeleteFile(file.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Privacy Note */}
        <div className="flex items-center gap-2 rounded-xl bg-slate-100/70 p-3 text-xs text-slate-600">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Your files are deleted right after printing.</span>
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      {files.length > 0 && !isPrinterOffline && (
        <StickyPayBar
          totalPaise={orderTotalPaise}
          buttonLabel="Configure Options"
          onClick={() => router.push(`/p/${slug}/options`)}
          disabled={files.some((f) => f.isUploading)}
          disabledReason={
            files.some((f) => f.isUploading) ? "Please wait for uploads to complete" : undefined
          }
        />
      )}
    </div>
  );
}

