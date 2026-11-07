import React from "react";
import { ArrowRight, Lock } from "lucide-react";

interface StickyPayBarProps {
  totalPaise: number;
  buttonLabel: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
  isLoading?: boolean;
}

export function StickyPayBar({
  totalPaise,
  buttonLabel,
  onClick,
  disabled = false,
  disabledReason,
  isLoading = false,
}: StickyPayBarProps) {
  const totalRs = (totalPaise / 100).toFixed(2);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur shadow-lg sm:static sm:rounded-b-2xl sm:border-t-0 sm:shadow-none">
      <div className="mx-auto flex max-w-md items-center justify-between gap-4">
        {/* Total Price Display */}
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Order Total
          </span>
          <p className="text-xl font-bold tracking-tight text-slate-900">
            Rs {totalRs}
          </p>
        </div>

        {/* Primary CTA Button (48px+ touch target) */}
        <div className="flex-1 max-w-[200px]">
          <button
            type="button"
            onClick={onClick}
            disabled={disabled || isLoading}
            className={`flex h-12 w-full items-center justify-center rounded-xl px-4 font-semibold text-white shadow-sm transition-all ${
              disabled || isLoading
                ? "bg-slate-300 cursor-not-allowed text-slate-500"
                : "bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-blue-500/20"
            }`}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Processing...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm">
                <span>{buttonLabel}</span>
                {buttonLabel.includes("Pay") ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </span>
            )}
          </button>
        </div>
      </div>

      {disabled && disabledReason && (
        <p className="mt-1 text-center text-xs text-rose-600 font-medium">
          {disabledReason}
        </p>
      )}
    </div>
  );
}

