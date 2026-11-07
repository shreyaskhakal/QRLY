import { describe, it, expect } from "vitest";
import { parsePageRange } from "../parsePageRange";

describe("parsePageRange", () => {
  it("parses single range '1-5' correctly", () => {
    const result = parsePageRange("1-5", 10);
    expect(result.valid).toBe(true);
    expect(result.pages).toEqual([1, 2, 3, 4, 5]);
    expect(result.selectedCount).toBe(5);
  });

  it("parses compound comma-separated ranges '1-3, 5, 8-10' correctly", () => {
    const result = parsePageRange("1-3, 5, 8-10", 10);
    expect(result.valid).toBe(true);
    expect(result.pages).toEqual([1, 2, 3, 5, 8, 9, 10]);
    expect(result.selectedCount).toBe(7);
  });

  it("handles padded whitespace '  1 - 3 ,  7 ' cleanly", () => {
    const result = parsePageRange("  1 - 3 ,  7 ", 10);
    expect(result.valid).toBe(true);
    expect(result.pages).toEqual([1, 2, 3, 7]);
    expect(result.selectedCount).toBe(4);
  });

  it("parses single page number '5' correctly", () => {
    const result = parsePageRange("5", 10);
    expect(result.valid).toBe(true);
    expect(result.pages).toEqual([5]);
    expect(result.selectedCount).toBe(1);
  });

  it("defaults to all pages when input is empty string, null, or undefined", () => {
    const emptyResult = parsePageRange("", 6);
    expect(emptyResult.valid).toBe(true);
    expect(emptyResult.pages).toEqual([1, 2, 3, 4, 5, 6]);
    expect(emptyResult.selectedCount).toBe(6);

    const nullResult = parsePageRange(null, 4);
    expect(nullResult.valid).toBe(true);
    expect(nullResult.pages).toEqual([1, 2, 3, 4]);

    const undefinedResult = parsePageRange(undefined, 3);
    expect(undefinedResult.valid).toBe(true);
    expect(undefinedResult.pages).toEqual([1, 2, 3]);
  });

  it("deduplicates and sorts overlapping ranges '1-3, 2-4'", () => {
    const result = parsePageRange("1-3, 2-4", 10);
    expect(result.valid).toBe(true);
    expect(result.pages).toEqual([1, 2, 3, 4]);
    expect(result.selectedCount).toBe(4);
  });

  it("deduplicates non-sequential duplicates '5, 2, 5, 1'", () => {
    const result = parsePageRange("5, 2, 5, 1", 10);
    expect(result.valid).toBe(true);
    expect(result.pages).toEqual([1, 2, 5]);
    expect(result.selectedCount).toBe(3);
  });

  it("rejects reversed ranges '5-2'", () => {
    const result = parsePageRange("5-2", 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Reversed range");
    expect(result.pages).toEqual([]);
    expect(result.selectedCount).toBe(0);
  });

  it("rejects pages out of bounds '1-12' for a 10-page document", () => {
    const result = parsePageRange("1-12", 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("exceeds total document pages (10)");
  });

  it("rejects single page out of bounds '15' for a 10-page document", () => {
    const result = parsePageRange("15", 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("exceeds total document pages (10)");
  });

  it("rejects non-numeric characters and letters '1-3, abc, 5'", () => {
    const result = parsePageRange("1-3, abc, 5", 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("contains invalid characters");
  });

  it("rejects zero and negative page numbers '0-3' or '-2'", () => {
    const zeroResult = parsePageRange("0-3", 10);
    expect(zeroResult.valid).toBe(false);
    expect(zeroResult.error).toContain("Page numbers must be 1 or greater");

    const negResult = parsePageRange("-2", 10);
    expect(negResult.valid).toBe(false);
  });

  it("rejects invalid document pageCount <= 0", () => {
    const result = parsePageRange("1-3", 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid document page count: 0");
  });
});

