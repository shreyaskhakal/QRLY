import React from "react";
import type { ColorMode } from "@/lib/types";
import { Check } from "lucide-react";

interface OptionToggleCardProps {
  selectedMode: ColorMode;
  bwRatePaise: number;
  colorRatePaise: number;
  onChange: (mode: ColorMode) => void;
}

export function OptionToggleCard({
  selectedMode,
  bwRatePaise,
  colorRatePaise,
  onChange,
}: OptionToggleCardProps) {
  const bwRateRs = (bwRatePaise / 100).toFixed(2);
  const colorRateRs = (colorRatePaise / 100).toFixed(2);

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Black & White Card */}
      <button
        type="button"
        onClick={() => onChange("bw")}
        className={`relative flex min-h-[72px] flex-col justify-center rounded-xl border p-3 text-left transition-all ${
          selectedMode === "bw"
            ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-600"
            : "border-slate-200 bg-white hover:border-slate-300"
        }`}
      >
        {selectedMode === "bw" && (
          <span className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white">
            <Check className="h-3 w-3 stroke-[3]" />
          </span>
        )}
        <span className="font-semibold text-sm text-slate-900">Black & White</span>
        <span className="text-xs text-slate-500 mt-0.5">Rs {bwRateRs} / page</span>
      </button>

      {/* Full Color Card */}
      <button
        type="button"
        onClick={() => onChange("color")}
        className={`relative flex min-h-[72px] flex-col justify-center rounded-xl border p-3 text-left transition-all ${
          selectedMode === "color"
            ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-600"
            : "border-slate-200 bg-white hover:border-slate-300"
        }`}
      >
        {selectedMode === "color" && (
          <span className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white">
            <Check className="h-3 w-3 stroke-[3]" />
          </span>
        )}
        <span className="font-semibold text-sm text-slate-900">Full Color</span>
        <span className="text-xs text-slate-500 mt-0.5">Rs {colorRateRs} / page</span>
      </button>
    </div>
  );
}

