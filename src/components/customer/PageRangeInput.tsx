import React, { useState, useEffect } from "react";
import { parsePageRange } from "@/lib/parser/parsePageRange";

interface PageRangeInputProps {
  totalPages: number;
  initialRange?: string | null;
  onChange: (range: string | null, selectedPagesCount: number) => void;
}

export function PageRangeInput({
  totalPages,
  initialRange,
  onChange,
}: PageRangeInputProps) {
  const [mode, setMode] = useState<"all" | "custom">(
    initialRange && initialRange.trim() !== "" ? "custom" : "all"
  );
  const [rangeText, setRangeText] = useState(initialRange ?? "");
  const [validation, setValidation] = useState(() =>
    parsePageRange(initialRange, totalPages)
  );

  useEffect(() => {
    if (mode === "all") {
      onChange(null, totalPages);
      setValidation(parsePageRange(null, totalPages));
    } else {
      const result = parsePageRange(rangeText, totalPages);
      setValidation(result);
      if (result.valid) {
        onChange(rangeText, result.selectedCount);
      }
    }
  }, [mode, rangeText, totalPages, onChange]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-4 text-xs font-medium">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`page-mode-${totalPages}`}
            checked={mode === "all"}
            onChange={() => setMode("all")}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300"
          />
          <span className="text-slate-800">All pages ({totalPages})</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`page-mode-${totalPages}`}
            checked={mode === "custom"}
            onChange={() => setMode("custom")}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300"
          />
          <span className="text-slate-800">Custom range</span>
        </label>
      </div>

      {mode === "custom" && (
        <div className="space-y-1.5 animate-in fade-in duration-200">
          <input
            type="text"
            value={rangeText}
            onChange={(e) => setRangeText(e.target.value)}
            placeholder="e.g. 1-3, 5, 8-10"
            className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm outline-none transition-colors ${
              validation.valid
                ? "border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                : "border-rose-400 bg-rose-50/30 text-rose-900 focus:border-rose-500"
            }`}
          />

          {validation.valid ? (
            <p className="text-xs text-emerald-600 font-medium">
              ✓ You selected {validation.selectedCount}{" "}
              {validation.selectedCount === 1 ? "page" : "pages"}
            </p>
          ) : (
            <p className="text-xs text-rose-600 font-medium">{validation.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

