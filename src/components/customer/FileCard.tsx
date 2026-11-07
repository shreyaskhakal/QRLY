import React from "react";
import { FileText, Image as ImageIcon, Trash2 } from "lucide-react";

interface FileCardProps {
  name: string;
  sizeBytes: number;
  mimeType: string;
  pageCount?: number;
  isUploading?: boolean;
  uploadProgress?: number;
  onDelete?: () => void;
}

export function FileCard({
  name,
  sizeBytes,
  mimeType,
  pageCount = 1,
  isUploading = false,
  uploadProgress = 100,
  onDelete,
}: FileCardProps) {
  const isPdf = mimeType === "application/pdf";
  const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="relative rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-slate-300">
      <div className="flex items-center gap-3">
        {/* File Format Icon */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            isPdf ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"
          }`}
        >
          {isPdf ? <FileText className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
        </div>

        {/* File Metadata */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800" title={name}>
            {name}
          </p>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
            <span>{sizeMb} MB</span>
            <span>•</span>
            <span className="font-medium text-slate-700">
              {pageCount} {pageCount === 1 ? "page" : "pages"}
            </span>
          </div>
        </div>

        {/* Delete Action */}
        {onDelete && !isUploading && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Remove document"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Upload Progress Bar */}
      {isUploading && (
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-blue-600 transition-all duration-300 rounded-full"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

