import Link from "next/link";
import { Printer, QrCode, ShieldCheck, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col justify-between p-6">
      <div className="space-y-6 pt-8">
        {/* Brand header */}
        <div className="flex items-center space-x-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
            <Printer className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">QRLY</h1>
            <p className="text-xs font-medium text-slate-500">Autonomous QR Print Kiosk</p>
          </div>
        </div>

        {/* Value proposition card */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
          <div className="flex items-start space-x-3">
            <Zap className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Scan & Print in Under 60 Seconds</h2>
              <p className="text-xs text-slate-600 mt-1">
                No app installation. No account needed. Upload your document, pick print settings, and pay with any UPI app.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Privacy by Default</h2>
              <p className="text-xs text-slate-600 mt-1">
                Your files are permanently deleted from all cloud and local storage immediately after printing.
              </p>
            </div>
          </div>
        </div>

        {/* Demo navigation actions */}
        <div className="space-y-3 pt-2">
          <Link
            href="/p/quickprint"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 font-semibold text-white shadow transition-colors hover:bg-blue-700 active:bg-blue-800"
          >
            <QrCode className="mr-2 h-5 w-5" />
            Open Demo Kiosk (/p/quickprint)
          </Link>

          <Link
            href="/dashboard"
            className="flex h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-white font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            Shop Owner Dashboard
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400">
        QRLY Platform · Phase 1 Foundation Active
      </footer>
    </div>
  );
}

