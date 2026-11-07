"use client";

import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import {
  Download,
  Printer,
  Copy,
  Check,
  ShieldCheck,
} from "lucide-react";

export default function DashboardQrPage() {
  const [shopSlug, setShopSlug] = useState("quickprint");
  const [shopName, setShopName] = useState("QuickPrint Express Kiosk");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [fullUrl, setFullUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch shop details
    fetch("/api/dashboard/summary")
      .then((res) => res.json())
      .then((data) => {
        if (data.shop) {
          setShopSlug(data.shop.slug);
          setShopName(data.shop.name);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://qrly.in";
    const targetUrl = `${origin}/p/${shopSlug}`;
    setFullUrl(targetUrl);

    // Generate High-Res QR code
    QRCode.toDataURL(
      targetUrl,
      {
        width: 800,
        margin: 2,
        color: {
          dark: "#020617", // slate-950
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "H",
      },
      (err, url) => {
        if (!err && url) {
          setQrDataUrl(url);
        }
      }
    );
  }, [shopSlug]);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qrly_kiosk_${shopSlug}_standee.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrintSheet = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <div className="print:hidden">
        <DashboardNav shopName={shopName} shopSlug={shopSlug} />
      </div>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        {/* Screen Header - hidden when printing */}
        <div className="print:hidden mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Kiosk QR Standee & Poster
            </h1>
            <p className="text-sm text-slate-400">
              Download high-res PNG for counter displays or print formatted A4 kiosk standee sheet
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleDownloadPng}
              disabled={!qrDataUrl}
              className="flex items-center space-x-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Download className="h-4 w-4 text-amber-400" />
              <span>Download High-Res PNG</span>
            </button>

            <button
              onClick={handlePrintSheet}
              className="flex items-center space-x-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-300 transition-colors shadow-lg shadow-amber-400/20"
            >
              <Printer className="h-4 w-4" />
              <span>Print QR Standee Sheet</span>
            </button>
          </div>
        </div>

        {/* URL Box - hidden when printing */}
        <div className="print:hidden mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs text-slate-300">
            <span className="text-slate-500">Kiosk Customer URL:</span>
            <code className="rounded bg-slate-950 px-2 py-1 font-mono text-amber-400">
              {fullUrl}
            </code>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "Copied" : "Copy Link"}</span>
          </button>
        </div>

        {/* Standee Sheet (Print Optimized) */}
        <div
          ref={printAreaRef}
          className="mx-auto max-w-md rounded-3xl border border-slate-800 bg-white p-8 text-slate-950 shadow-2xl print:border-none print:shadow-none print:p-0 print:max-w-none"
        >
          {/* Header */}
          <div className="text-center border-b border-slate-200 pb-6">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 font-black text-xl text-slate-950 shadow-md mb-2">
              Q
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">
              {shopName}
            </h2>
            <div className="inline-block mt-1 rounded-full bg-slate-100 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-600">
              Self-Serve Instant Printing
            </div>
          </div>

          {/* QR Code Presentation */}
          <div className="my-6 flex flex-col items-center justify-center">
            <div className="rounded-2xl border-4 border-slate-900 p-3 bg-white shadow-xl">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="Scan to Print QR Code"
                  className="h-64 w-64 object-contain rounded-lg"
                />
              ) : (
                <div className="h-64 w-64 flex items-center justify-center bg-slate-100 text-xs text-slate-400">
                  Generating QR...
                </div>
              )}
            </div>
            <p className="mt-3 font-mono text-xs font-bold text-slate-700 tracking-wide">
              Scan with any Smartphone Camera
            </p>
          </div>

          {/* 4-Step Instructions */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-3.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
              How it Works • 4 Simple Steps
            </h3>

            <div className="flex items-start space-x-3 text-xs">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 font-bold text-slate-950">
                1
              </div>
              <div>
                <span className="font-bold text-slate-900">Scan QR Code: </span>
                <span className="text-slate-600">Open your phone camera & tap the link.</span>
              </div>
            </div>

            <div className="flex items-start space-x-3 text-xs">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 font-bold text-slate-950">
                2
              </div>
              <div>
                <span className="font-bold text-slate-900">Upload Documents: </span>
                <span className="text-slate-600">Select PDF, JPG, or PNG & choose options.</span>
              </div>
            </div>

            <div className="flex items-start space-x-3 text-xs">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 font-bold text-slate-950">
                3
              </div>
              <div>
                <span className="font-bold text-slate-900">Pay via UPI: </span>
                <span className="text-slate-600">Pay securely with GPay, PhonePe, or Paytm.</span>
              </div>
            </div>

            <div className="flex items-start space-x-3 text-xs">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 font-bold text-slate-950">
                4
              </div>
              <div>
                <span className="font-bold text-slate-900">Collect Print: </span>
                <span className="text-slate-600">Pages print automatically into tray.</span>
              </div>
            </div>
          </div>

          {/* Privacy Guarantee Footer */}
          <div className="mt-6 border-t border-slate-200 pt-4 flex items-center justify-center space-x-2 text-[11px] text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Files are permanently destroyed immediately upon printing.</span>
          </div>
        </div>
      </main>
    </div>
  );
}
