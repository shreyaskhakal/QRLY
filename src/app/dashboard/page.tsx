"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import {
  IndianRupee,
  Printer,
  FileCheck2,
  AlertTriangle,
  RefreshCw,
  PauseCircle,
  PlayCircle,
  ArrowRight,
  Clock,
  Layers,
} from "lucide-react";

interface SummaryData {
  shop: {
    id: string;
    slug: string;
    name: string;
    acceptingOrders: boolean;
    bwPricePaise: number;
    colorPricePaise: number;
    orderExpiryMinutes: number;
  };
  todayEarningsPaise: number;
  todayJobsCount: number;
  todayPagesCount: number;
  printer: {
    systemName: string;
    status: "online" | "offline" | "error";
    statusDetail: string;
    lastSeenAt: string | null;
    supportsColor: boolean;
    supportsDuplex: boolean;
  };
}

interface RecentJob {
  id: string;
  tokenLabel: string;
  orderTotalPaise: number;
  status: string;
  createdAt: string;
  file: {
    originalName: string;
    selectedPages: number;
    copies: number;
    colorMode: string;
  } | null;
}

export default function DashboardOverviewPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch summary
      const sumRes = await fetch("/api/dashboard/summary");
      if (!sumRes.ok) throw new Error("Failed to load dashboard summary");
      const sumData = await sumRes.json();
      setData(sumData);

      // Fetch recent 5 jobs
      const jobsRes = await fetch("/api/dashboard/jobs?limit=5");
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setRecentJobs(jobsData.jobs || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const handleToggleAcceptingOrders = async () => {
    if (!data) return;
    try {
      setToggling(true);
      const nextState = !data.shop.acceptingOrders;

      const res = await fetch("/api/dashboard/shop", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptingOrders: nextState }),
      });

      if (!res.ok) throw new Error("Failed to update status");
      const updated = await res.json();

      setData((prev) =>
        prev
          ? {
              ...prev,
              shop: {
                ...prev.shop,
                acceptingOrders: updated.shop.accepting_orders ?? nextState,
              },
            }
          : null
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to toggle status");
    } finally {
      setToggling(false);
    }
  };

  const getRelativeTime = (iso: string | null) => {
    if (!iso) return "Never";
    const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 5) return "Just now";
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    return `${Math.floor(sec / 3600)}h ago`;
  };

  const shopName = data?.shop.name || "QuickPrint Kiosk";
  const shopSlug = data?.shop.slug || "quickprint";
  const printer = data?.printer;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardNav
        shopName={shopName}
        shopSlug={shopSlug}
        printerStatus={printer?.status}
        acceptingOrders={data?.shop.acceptingOrders}
      />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Operations Center
            </h1>
            <p className="text-sm text-slate-400">
              Live telemetry, revenue figures, and hardware controls
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => fetchDashboardData()}
              disabled={loading}
              className="flex items-center space-x-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleToggleAcceptingOrders}
              disabled={toggling || !data}
              className={`flex items-center space-x-2 rounded-lg px-4 py-2 text-xs font-bold transition-all shadow-md ${
                data?.shop.acceptingOrders
                  ? "bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
                  : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              }`}
            >
              {data?.shop.acceptingOrders ? (
                <>
                  <PauseCircle className="h-4 w-4" />
                  <span>{toggling ? "Pausing..." : "Emergency Pause Kiosk"}</span>
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" />
                  <span>{toggling ? "Resuming..." : "Resume Accepting Orders"}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400 flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Top Metrics Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {/* Revenue */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Today&apos;s Revenue
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400">
                <IndianRupee className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline space-x-2">
              <span className="text-3xl font-black tracking-tight text-white">
                ₹{((data?.todayEarningsPaise || 0) / 100).toFixed(2)}
              </span>
              <span className="text-xs text-slate-500">gross collected</span>
            </div>
          </div>

          {/* Jobs Count */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Jobs Processed Today
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-400">
                <Printer className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline space-x-2">
              <span className="text-3xl font-black tracking-tight text-white">
                {data?.todayJobsCount || 0}
              </span>
              <span className="text-xs text-slate-500">spooled jobs</span>
            </div>
          </div>

          {/* Pages Count */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Pages Printed Today
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400">
                <FileCheck2 className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline space-x-2">
              <span className="text-3xl font-black tracking-tight text-white">
                {data?.todayPagesCount || 0}
              </span>
              <span className="text-xs text-slate-500">sheets delivered</span>
            </div>
          </div>
        </div>

        {/* Hardware Status & Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Printer Telemetry Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg lg:col-span-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center justify-between">
              <span>Hardware Telemetry</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                  printer?.status === "online"
                    ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/30"
                    : printer?.status === "error"
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                    : "bg-amber-400/10 text-amber-400 border border-amber-400/30"
                }`}
              >
                ● {printer?.status?.toUpperCase()}
              </span>
            </h2>

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-xs text-slate-500">Assigned Device</div>
                <div className="text-base font-semibold text-white mt-0.5">
                  {printer?.systemName || "Local Spooler"}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {printer?.statusDetail || "Ready"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="text-slate-500 flex items-center space-x-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Last Heartbeat</span>
                  </div>
                  <div className="text-sm font-bold text-slate-200 mt-1">
                    {getRelativeTime(printer?.lastSeenAt ?? null)}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="text-slate-500 flex items-center space-x-1">
                    <Layers className="h-3.5 w-3.5" />
                    <span>Capabilities</span>
                  </div>
                  <div className="text-sm font-bold text-slate-200 mt-1">
                    {printer?.supportsColor ? "Color" : "Mono"} • {printer?.supportsDuplex ? "2-Sided" : "1-Sided"}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/dashboard/settings"
                  className="w-full flex items-center justify-center space-x-2 rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  <span>Configure Agent & Rates</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Queue Activity */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Recent Queue Activity
              </h2>
              <Link
                href="/dashboard/jobs"
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center space-x-1"
              >
                <span>View Full Queue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {recentJobs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center">
                <Printer className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                <p className="text-sm text-slate-400 font-medium">No print jobs received today yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Customer submissions via the kiosk QR code will appear here in real time.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="pb-3">Token</th>
                      <th className="pb-3">Document</th>
                      <th className="pb-3">Pages</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {recentJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 font-mono font-bold text-amber-400">
                          {job.tokenLabel}
                        </td>
                        <td className="py-3 max-w-[200px] truncate text-slate-200 font-medium">
                          {job.file?.originalName || "Document"}
                        </td>
                        <td className="py-3 text-slate-400">
                          {job.file ? `${job.file.selectedPages}p × ${job.file.copies}` : "—"}
                        </td>
                        <td className="py-3 font-semibold text-slate-200">
                          ₹{((job.orderTotalPaise || 0) / 100).toFixed(2)}
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                              job.status === "done"
                                ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
                                : job.status === "printing"
                                ? "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 animate-pulse"
                                : job.status === "failed"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                            }`}
                          >
                            {job.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
