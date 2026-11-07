import type { PageRangeParseResult } from "@/lib/types";

/**
 * Parses and validates a human-entered page range string against a document's total page count.
 *
 * Supported syntax:
 *   - "1-3, 5, 8-10"
 *   - "1"
 *   - "  1 - 4 , 7 "
 *
 * Rules:
 *   - Empty / undefined input returns all pages [1..pageCount].
 *   - Whitespace is stripped automatically.
 *   - Ranges that go backwards (e.g., "5-2") are invalid.
 *   - Page numbers must be between 1 and pageCount (inclusive).
 *   - Letters or foreign characters are invalid.
 *   - Duplicate pages are deduplicated and output is strictly sorted ascending.
 */
export function parsePageRange(
  input: string | null | undefined,
  pageCount: number
): PageRangeParseResult {
  if (!Number.isInteger(pageCount) || pageCount <= 0) {
    return {
      valid: false,
      pages: [],
      selectedCount: 0,
      error: `Invalid document page count: ${pageCount}. Must be a positive integer.`,
    };
  }

  // If no range specified or empty string, default to all pages
  if (!input || input.trim() === "") {
    const allPages = Array.from({ length: pageCount }, (_, i) => i + 1);
    return {
      valid: true,
      pages: allPages,
      selectedCount: pageCount,
    };
  }

  const trimmed = input.trim();

  // Validate allowed characters: digits, comma, hyphen, whitespace
  if (!/^[\d\s,-]+$/.test(trimmed)) {
    return {
      valid: false,
      pages: [],
      selectedCount: 0,
      error: "Page range contains invalid characters. Use only numbers, commas, and hyphens.",
    };
  }

  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    return {
      valid: false,
      pages: [],
      selectedCount: 0,
      error: "Page range cannot be empty when specified.",
    };
  }

  const pageSet = new Set<number>();

  for (const part of parts) {
    if (part.includes("-")) {
      const rangeParts = part.split("-").map((r) => r.trim());
      if (rangeParts.length !== 2 || rangeParts[0] === "" || rangeParts[1] === "") {
        return {
          valid: false,
          pages: [],
          selectedCount: 0,
          error: `Malformed range segment: '${part}'`,
        };
      }

      const start = Number(rangeParts[0]);
      const end = Number(rangeParts[1]);

      if (!Number.isInteger(start) || !Number.isInteger(end)) {
        return {
          valid: false,
          pages: [],
          selectedCount: 0,
          error: `Non-integer page number in range: '${part}'`,
        };
      }

      if (start <= 0 || end <= 0) {
        return {
          valid: false,
          pages: [],
          selectedCount: 0,
          error: `Page numbers must be 1 or greater: '${part}'`,
        };
      }

      if (start > end) {
        return {
          valid: false,
          pages: [],
          selectedCount: 0,
          error: `Reversed range: '${start}-${end}'. Start page cannot be greater than end page.`,
        };
      }

      if (end > pageCount) {
        return {
          valid: false,
          pages: [],
          selectedCount: 0,
          error: `Page ${end} exceeds total document pages (${pageCount}).`,
        };
      }

      for (let p = start; p <= end; p++) {
        pageSet.add(p);
      }
    } else {
      const page = Number(part);
      if (!Number.isInteger(page)) {
        return {
          valid: false,
          pages: [],
          selectedCount: 0,
          error: `Invalid page number: '${part}'`,
        };
      }

      if (page <= 0) {
        return {
          valid: false,
          pages: [],
          selectedCount: 0,
          error: `Page numbers must be 1 or greater: '${part}'`,
        };
      }

      if (page > pageCount) {
        return {
          valid: false,
          pages: [],
          selectedCount: 0,
          error: `Page ${page} exceeds total document pages (${pageCount}).`,
        };
      }

      pageSet.add(page);
    }
  }

  const sortedPages = Array.from(pageSet).sort((a, b) => a - b);

  return {
    valid: true,
    pages: sortedPages,
    selectedCount: sortedPages.length,
  };
}

