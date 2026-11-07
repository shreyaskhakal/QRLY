import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { inspectPdfBuffer } from "../pdfInspector";

describe("inspectPdfBuffer", () => {
  it("authoritatively counts pages of a valid generated 3-page PDF", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 600]);
    doc.addPage([400, 600]);
    doc.addPage([400, 600]);
    const pdfBytes = await doc.save();

    const result = await inspectPdfBuffer(pdfBytes);
    expect(result.pageCount).toBe(3);
    expect(result.isEncrypted).toBe(false);
  });

  it("authoritatively counts single page PDF", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    const pdfBytes = await doc.save();

    const result = await inspectPdfBuffer(pdfBytes);
    expect(result.pageCount).toBe(1);
  });

  it("rejects corrupt or malformed PDF data with CORRUPT_DOCUMENT error", async () => {
    const corruptBuffer = Buffer.from("%PDF-1.4\nBROKEN_HEADER_AND_TRAILER_CORRUPT_BYTES");

    await expect(inspectPdfBuffer(corruptBuffer)).rejects.toThrowError(
      "The uploaded document is corrupted or malformed and could not be processed."
    );
  });
});

