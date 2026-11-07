import Link from "next/link";
import {
  QrCode,
  ShieldCheck,
  LayoutDashboard,
  ArrowRight,
  IndianRupee,
  Cpu,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 font-black text-slate-950 shadow-lg shadow-amber-400/20">
              Q
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-white text-lg">QRLY</span>
              <span className="ml-2 rounded-full bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                Production Ready
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs font-semibold">
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Owner Portal
            </Link>
            <Link
              href="/p/quickprint"
              className="rounded-xl bg-amber-400 px-4 py-2 text-slate-950 hover:bg-amber-300 transition-colors shadow-md shadow-amber-400/20 font-bold"
            >
              Demo Kiosk
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-12 sm:py-20 flex flex-col items-center text-center">
        {/* Status Pill */}
        <div className="inline-flex items-center space-x-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400 mb-8">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Autonomous Kiosk Engine Active · All 7 Workstreams Online</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white max-w-3xl leading-[1.1]">
          Self-Service Document Printing, Powered by{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500">
            QR &amp; UPI
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
          Transform any standard office or shop printer into an autonomous revenue kiosk. Customers
          scan, upload, customize, and pay with any UPI app. The local print daemon prints
          automatically with zero staff intervention.
        </p>

        {/* Dual CTA Actions */}
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link
            href="/p/quickprint"
            className="w-full sm:w-auto flex items-center justify-center space-x-2.5 rounded-2xl bg-amber-400 px-8 py-4 text-base font-black text-slate-950 hover:bg-amber-300 transition-all shadow-xl shadow-amber-400/25 hover:scale-[1.02]"
          >
            <QrCode className="h-5 w-5" />
            <span>Launch Customer Flow (/p/quickprint)</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            href="/dashboard"
            className="w-full sm:w-auto flex items-center justify-center space-x-2 rounded-2xl border border-slate-700 bg-slate-900 px-7 py-4 text-base font-bold text-white hover:bg-slate-800 transition-colors"
          >
            <LayoutDashboard className="h-5 w-5 text-amber-400" />
            <span>Open Shop Dashboard</span>
          </Link>
        </div>

        {/* Core Architectural Guarantees */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full">
          {/* Card 1: Zero Ports */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-sm shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 mb-5">
              <Cpu className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Zero Inbound Open Ports</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              No router firewall changes or port forwards. The Python daemon polls outbound HTTPS
              using secure bearer tokens, claims next jobs atomically, and prints locally via CUPS or
              SumatraPDF.
            </p>
          </div>

          {/* Card 2: Privacy */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-sm shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 mb-5">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Verified Cryptographic Purge</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Customer privacy guaranteed by design. Documents are permanently erased from cloud
              storage and agent temp disks immediately upon print completion, with verified
              confirmation badges.
            </p>
          </div>

          {/* Card 3: Zero Floats */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-sm shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 mb-5">
              <IndianRupee className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Integer Paise Financial Engine</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Strict zero-float monetary architecture. All pricing, Razorpay captures, and revenue
              metrics operate strictly in whole integer paise (₹1 = 100p), preventing fractional
              rounding discrepancies.
            </p>
          </div>
        </div>

        {/* 4-Step Process Section */}
        <div className="mt-20 w-full rounded-3xl border border-slate-800 bg-slate-900/40 p-8 sm:p-12 text-left">
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400">
              Customer Journey
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              Print in Under 60 Seconds
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 font-black text-slate-950 text-xs mb-3">
                1
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Scan Counter QR</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Customer scans the standee QR code with any smartphone camera. Zero app install.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 font-black text-slate-950 text-xs mb-3">
                2
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Upload &amp; Options</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Upload PDF, JPG, or PNG. Choose color or B&amp;W, copies, page range, and duplex.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 font-black text-slate-950 text-xs mb-3">
                3
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Instant UPI Payment</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Pay securely via Razorpay Standard Checkout with GPay, PhonePe, Paytm, or CRED.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 font-black text-slate-950 text-xs mb-3">
                4
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Auto-Print &amp; Purge</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Hardware agent spools prints into tray immediately and wipes files from disk and cloud.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-300">QRLY Platform</span>
            <span>·</span>
            <span>Autonomous QR Print Kiosk</span>
          </div>

          <div className="flex items-center space-x-6 text-slate-400 font-medium">
            <Link href="/p/quickprint" className="hover:text-amber-400 transition-colors">
              Customer Kiosk
            </Link>
            <Link href="/dashboard" className="hover:text-amber-400 transition-colors">
              Owner Dashboard
            </Link>
            <Link href="/dashboard/qr" className="hover:text-amber-400 transition-colors">
              QR Standee
            </Link>
            <a
              href="https://github.com/shreyaskhakal/QRLY"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub Repository
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
