"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Printer,
  Settings,
  QrCode,
  ExternalLink,
  Power,
  Store,
} from "lucide-react";

interface DashboardNavProps {
  shopName: string;
  shopSlug: string;
  printerStatus?: "online" | "offline" | "error";
  acceptingOrders?: boolean;
}

export function DashboardNav({
  shopName,
  shopSlug,
  printerStatus = "offline",
  acceptingOrders = true,
}: DashboardNavProps) {
  const pathname = usePathname();

  const navLinks = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/jobs", label: "Print Queue", icon: Printer },
    { href: "/dashboard/settings", label: "Pricing & Settings", icon: Settings },
    { href: "/dashboard/qr", label: "QR Code Standee", icon: QrCode },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand & Shop Status */}
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 font-black text-slate-950 shadow-md">
            Q
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-white tracking-tight">{shopName}</span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] font-mono text-slate-400">
                /{shopSlug}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  printerStatus === "online"
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                    : printerStatus === "error"
                    ? "bg-rose-500"
                    : "bg-amber-400"
                }`}
              />
              <span className="text-slate-400 capitalize">
                Printer {printerStatus}
              </span>
              {!acceptingOrders && (
                <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400">
                  PAUSED
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="hidden md:flex items-center space-x-1">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center space-x-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-amber-400/10 text-amber-400"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right side actions */}
        <div className="flex items-center space-x-3">
          <Link
            href={`/p/${shopSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-600 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <Store className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden sm:inline">Customer Portal</span>
            <ExternalLink className="h-3 w-3 text-slate-500" />
          </Link>

          <Link
            href="/dashboard/login"
            className="flex items-center space-x-1 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
            title="Switch Account / Sign Out"
          >
            <Power className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Mobile Tab Bar */}
      <div className="flex md:hidden border-t border-slate-800/60 px-2 py-1 overflow-x-auto">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 items-center justify-center space-x-1.5 py-2 text-xs font-medium whitespace-nowrap rounded-md ${
                isActive
                  ? "bg-amber-400/10 text-amber-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
