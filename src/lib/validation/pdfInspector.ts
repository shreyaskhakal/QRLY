import { PDFDocument } from "pdf-lib";
import { AppError } from "@/lib/errors";

export interface PdfInspectionResult {
  pageCount: number;
  isEncrypted: boolean;
}

/**
 * Authoritatively reads and validates a PDF binary buffer.
 * Extracts the exact page count.
 * Rejects encrypted or corrupted documents with user-friendly errors.
 */
export async function inspectPdfBuffer(buffer: Buffer | Uint8Array): Promise<PdfInspectionResult> {
  try {
    const pdfDoc = await PDFDocument.load(buffer, {
      ignoreEncryption: false,
    });

    const pageCount = pdfDoc.getPageCount();

    if (pageCount <= 0) {
      throw AppError.badRequest(
        "The uploaded PDF has 0 readable pages.",
        "EMPTY_DOCUMENT"
      );
    }

    return {
      pageCount,
      isEncrypted: false,
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("encrypt") || message.includes("password")) {
      throw AppError.badRequest(
        "Password-protected or encrypted PDFs are not supported. Please remove the password and try again.",
        "ENCRYPTED_PDF_NOT_SUPPORTED"
      );
    }

    throw AppError.badRequest(
      "The uploaded document is corrupted or malformed and could not be processed.",
      "CORRUPT_DOCUMENT"
    );
  }
}

