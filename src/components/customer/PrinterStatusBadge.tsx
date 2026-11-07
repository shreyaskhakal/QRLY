import React from "react";
import type { PrinterStatus } from "@/lib/types";

interface PrinterStatusBadgeProps {
  status: PrinterStatus;
  activeQueueLength?: number;
}

export function PrinterStatusBadge({
  status,
  activeQueueLength = 0,
}: PrinterStatusBadgeProps) {
  const isOnline = status === "online";
  const isError = status === "error";

  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <div
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
          isOnline
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : isError
            ? "bg-amber-50 text-amber-700 border border-amber-200"
            : "bg-rose-50 text-rose-700 border border-rose-200"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            isOnline
              ? "bg-emerald-500 animate-pulse"
              : isError
              ? "bg-amber-500"
              : "bg-rose-500"
          }`}
        />
        <span>
          {isOnline
            ? "Printer online"
            : isError
            ? "Printer warning"
            : "Printer offline"}
        </span>
      </div>

      {isOnline && (
        <span className="text-slate-500 font-medium">
          {activeQueueLength === 0
            ? "Queue empty · Instant print"
            : `${activeQueueLength} ${activeQueueLength === 1 ? "job" : "jobs"} ahead`}
        </span>
      )}
    </div>
  );
}

