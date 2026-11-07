import { describe, it, expect } from "vitest";
import { validateMagicBytes } from "../fileValidation";

describe("validateMagicBytes", () => {
  it("accepts valid PDF magic bytes (%PDF-)", () => {
    // 0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34
    const validPdfBuffer = Buffer.from("%PDF-1.4\n%test");
    const result = validateMagicBytes(validPdfBuffer, "application/pdf");
    expect(result.valid).toBe(true);
    expect(result.detectedMime).toBe("application/pdf");
  });

  it("accepts valid JPEG magic bytes (0xFF 0xD8 0xFF)", () => {
    const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const result = validateMagicBytes(validJpegBuffer, "image/jpeg");
    expect(result.valid).toBe(true);
    expect(result.detectedMime).toBe("image/jpeg");
  });

  it("accepts valid PNG magic bytes (0x89PNG...)", () => {
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const result = validateMagicBytes(validPngBuffer, "image/png");
    expect(result.valid).toBe(true);
    expect(result.detectedMime).toBe("image/png");
  });

  it("rejects Windows executable (MZ header) disguised as .pdf", () => {
    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const result = validateMagicBytes(exeBuffer, "application/pdf");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Executable files are strictly forbidden");
  });

  it("rejects Linux ELF binary header disguised as .pdf", () => {
    const elfBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
    const result = validateMagicBytes(elfBuffer, "application/pdf");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Binary executables are strictly forbidden");
  });

  it("rejects truncated or empty buffer < 8 bytes", () => {
    const emptyBuffer = Buffer.from([0x25, 0x50]);
    const result = validateMagicBytes(emptyBuffer, "application/pdf");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("less than 8 bytes");
  });

  it("rejects MIME type mismatch (declared image/png but header is PDF)", () => {
    const pdfBuffer = Buffer.from("%PDF-1.4\n...");
    const result = validateMagicBytes(pdfBuffer, "image/png");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("MIME type mismatch");
  });
});

