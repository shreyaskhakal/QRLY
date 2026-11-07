/**
 * Magic Bytes and Document Integrity Validation
 */

export interface MagicBytesResult {
  valid: boolean;
  detectedMime: string | null;
  error?: string;
}

/**
 * Validates the raw file buffer header against known magic byte signatures.
 * Never trusts the file extension or client-reported Content-Type header alone.
 */
export function validateMagicBytes(
  buffer: Buffer | Uint8Array,
  expectedMimeType: string
): MagicBytesResult {
  if (!buffer || buffer.length < 8) {
    return {
      valid: false,
      detectedMime: null,
      error: "File buffer is empty or corrupted (less than 8 bytes)",
    };
  }

  const bytes = buffer instanceof Buffer ? buffer : Buffer.from(buffer);

  // PDF Magic Bytes: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    if (expectedMimeType !== "application/pdf") {
      return {
        valid: false,
        detectedMime: "application/pdf",
        error: `MIME type mismatch: declared '${expectedMimeType}' but file header is PDF`,
      };
    }
    return { valid: true, detectedMime: "application/pdf" };
  }

  // JPEG Magic Bytes: 0xFF 0xD8 0xFF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    if (expectedMimeType !== "image/jpeg" && expectedMimeType !== "image/jpg") {
      return {
        valid: false,
        detectedMime: "image/jpeg",
        error: `MIME type mismatch: declared '${expectedMimeType}' but file header is JPEG`,
      };
    }
    return { valid: true, detectedMime: "image/jpeg" };
  }

  // PNG Magic Bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    if (expectedMimeType !== "image/png") {
      return {
        valid: false,
        detectedMime: "image/png",
        error: `MIME type mismatch: declared '${expectedMimeType}' but file header is PNG`,
      };
    }
    return { valid: true, detectedMime: "image/png" };
  }

  // Windows Executable / DLL check: MZ (0x4D 0x5A)
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) {
    return {
      valid: false,
      detectedMime: "application/x-dosexec",
      error: "Security violation: Executable files are strictly forbidden.",
    };
  }

  // ELF Binary: 0x7F 0x45 0x4C 0x46
  if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) {
    return {
      valid: false,
      detectedMime: "application/x-elf",
      error: "Security violation: Binary executables are strictly forbidden.",
    };
  }

  return {
    valid: false,
    detectedMime: null,
    error: `Unsupported or corrupted file format. Only PDF, JPG, and PNG documents are allowed.`,
  };
}

