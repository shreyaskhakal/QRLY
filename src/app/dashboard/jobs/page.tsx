"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import {
  Printer,
  RotateCcw,
  RefreshCw,
  Download,
  AlertCircle,
  Search,
  Ban,
  CheckCircle2,
} from "lucide-react";

interface JobItem {
  id: string;
  orderId: string;
  orderFileId: string;
  status: "queued" | "claimed" | "printing" | "done" | "failed" | "cancelled";
  attempts: number;
  claimedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  tokenLabel: string;
  orderTotalPaise: number;
  orderStatus: string;
  file: {
    originalName: string;
    mimeType: string;
    pageCount: number;
    colorMode: "bw" | "color";
    quality: string;
    copies: number;
    pageRange: string | null;
    selectedPages: number;
    sides: string;
    pricePaise: number;
    storagePath: string | null;
    deleteVerified: boolean;
  } | null;
}

export default function DashboardJobsPage() {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchToken, setSearchToken] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [actionJobId, setActionJobId] = useState<string | null>(null);
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [, startTransition] = useTransition();

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (dateFilter) params.set("date", dateFilter);
      params.set("limit", "100");

      const res = await fetch(`/api/dashboard/jobs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch {
      showToast("Error loading print queue", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFilter]);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 6000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleReprint = async (jobId: string) => {
    try {
      setActionJobId(jobId);
      const res = await fetch(`/api/dashboard/jobs/${jobId}/reprint`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Reprint failed");
      showToast("Job successfully re-queued for printing", "success");
      fetchJobs();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Reprint failed", "error");
    } finally {
      setActionJobId(null);
    }
  };

  const handleRefund = async (orderId: string) => {
    try {
      setActionJobId(orderId);
      const res = await fetch(`/api/dashboard/orders/${orderId}/refund`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Refund failed");
      const data = await res.json();
      showToast(`Order refunded (ID: ${data.refundId}). Customer files deleted.`, "success");
      setRefundOrderId(null);
      fetchJobs();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Refund failed", "error");
    } finally {
      setActionJobId(null);
    }
  };

  const exportCSV = () => {
    const headers = [
      "Token",
      "Job ID",
      "Order ID",
      "Document",
      "Status",
      "Color Mode",
      "Pages",
      "Copies",
      "Amount (Rs)",
      "Created At",
      "Error",
    ];

    const rows = filteredJobs.map((j) => [
      `"${j.tokenLabel}"`,
      `"${j.id}"`,
      `"${j.orderId}"`,
      `"${j.file?.originalName.replace(/"/g, '""') || "Document"}"`,
      `"${j.status}"`,
      `"${j.file?.colorMode || "bw"}"`,
      j.file?.selectedPages || 1,
      j.file?.copies || 1,
      ((j.orderTotalPaise || 0) / 100).toFixed(2),
      `"${new Date(j.createdAt).toLocaleString()}"`,
      `"${j.errorMessage?.replace(/"/g, '""') || ""}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `qrly_jobs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredJobs = jobs.filter((job) => {
    if (!searchToken) return true;
    const matchToken = job.tokenLabel.toLowerCase().includes(searchToken.toLowerCase());
    const matchDoc = job.file?.originalName.toLowerCase().includes(searchToken.toLowerCase());
    return matchToken || matchDoc;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardNav shopName="QuickPrint Kiosk" shopSlug="quickprint" />

      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-xl p-4 shadow-2xl border text-sm font-medium flex items-center space-x-2 ${
            toast.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-300"
              : "bg-rose-950/90 border-rose-500/50 text-rose-300"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Refund Confirmation Modal */}
      {refundOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
                <Ban className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Refund Customer Order?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              This will trigger a full refund via Razorpay, immediately delete all stored files for
              this order, and cancel any pending print tasks. This action cannot be reversed.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setRefundOrderId(null)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionJobId === refundOrderId}
                onClick={() => handleRefund(refundOrderId)}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {actionJobId === refundOrderId ? "Processing..." : "Confirm Full Refund"}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Live Queue & Job History
            </h1>
            <p className="text-sm text-slate-400">
              Manage incoming print tasks, handle reprints, and review error diagnostics
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchJobs()}
              disabled={loading}
              className="flex items-center space-x-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={exportCSV}
              disabled={filteredJobs.length === 0}
              className="flex items-center space-x-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1">
            {["all", "queued", "printing", "done", "failed"].map((st) => (
              <button
                key={st}
                onClick={() => startTransition(() => setStatusFilter(st))}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  statusFilter === st
                    ? "bg-amber-400 text-slate-950 shadow"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Search & Date Filter */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search token or file..."
                value={searchToken}
                onChange={(e) => setSearchToken(e.target.value)}
                className="w-48 sm:w-64 rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="relative">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Jobs Table */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
          {filteredJobs.length === 0 ? (
            <div className="p-12 text-center">
              <Printer className="mx-auto h-10 w-10 text-slate-600 mb-3" />
              <p className="text-base font-semibold text-slate-300">No print jobs found</p>
              <p className="text-xs text-slate-500 mt-1">
                {statusFilter !== "all"
                  ? `There are currently no jobs with status '${statusFilter}'.`
                  : "New orders will display here automatically."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Token</th>
                    <th className="py-3.5 px-4">Document</th>
                    <th className="py-3.5 px-4">Specs</th>
                    <th className="py-3.5 px-4">Amount</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Time</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredJobs.map((job) => {
                    const isFailed = job.status === "failed";
                    const isDone = job.status === "done";
                    const isPrinting = job.status === "printing";

                    return (
                      <tr key={job.id} className="hover:bg-slate-800/30 transition-colors">
                        {/* Token */}
                        <td className="py-4 px-4 font-mono font-bold text-amber-400 text-sm">
                          {job.tokenLabel}
                        </td>

                        {/* Document */}
                        <td className="py-4 px-4">
                          <div className="max-w-[220px] truncate font-medium text-slate-200">
                            {job.file?.originalName || "Document"}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {job.file?.pageCount || 1} pages total
                            {job.file?.pageRange ? ` • Range: ${job.file.pageRange}` : ""}
                          </div>
                          {job.errorMessage && (
                            <div className="mt-1 text-[11px] text-rose-400 font-mono">
                              Error: {job.errorMessage}
                            </div>
                          )}
                        </td>

                        {/* Specs */}
                        <td className="py-4 px-4 text-slate-300">
                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                job.file?.colorMode === "color"
                                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {job.file?.colorMode || "bw"}
                            </span>
                            <span className="text-slate-400">
                              {job.file?.selectedPages || 1}p × {job.file?.copies || 1}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 capitalize mt-0.5">
                            {job.file?.sides || "single"}-sided
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="py-4 px-4 font-bold text-slate-200">
                          ₹{((job.orderTotalPaise || 0) / 100).toFixed(2)}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                              isDone
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : isPrinting
                                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse"
                                : isFailed
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                            }`}
                          >
                            <span>●</span>
                            <span>{job.status}</span>
                          </span>
                        </td>

                        {/* Time */}
                        <td className="py-4 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                          {new Date(job.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {/* Reprint button */}
                            {(isFailed || isDone) && (
                              <button
                                type="button"
                                disabled={actionJobId === job.id}
                                onClick={() => handleReprint(job.id)}
                                className="flex items-center space-x-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:border-amber-400 hover:text-white transition-colors disabled:opacity-50"
                                title="Re-queue this document for printing"
                              >
                                <RotateCcw
                                  className={`h-3 w-3 ${actionJobId === job.id ? "animate-spin" : ""}`}
                                />
                                <span>Reprint</span>
                              </button>
                            )}

                            {/* Refund button */}
                            {job.orderStatus !== "refunded" && !isDone && (
                              <button
                                type="button"
                                onClick={() => setRefundOrderId(job.orderId)}
                                className="flex items-center space-x-1 rounded-lg border border-rose-900/40 bg-rose-950/20 px-2.5 py-1.5 text-[11px] font-semibold text-rose-400 hover:bg-rose-900/30 transition-colors"
                                title="Issue full refund to customer"
                              >
                                <Ban className="h-3 w-3" />
                                <span>Refund</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
