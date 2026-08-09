/**
 * Shared payment-proof file handling: content sniffing and filename hygiene.
 *
 * The stored mime/extension always come from the magic bytes, never from the
 * client-supplied filename or Content-Type.
 */

import { PROOF_MIMES } from "@/lib/validation";

export const PROOF_BUCKET = "payment-proofs";

export interface DetectedImage {
  mime: (typeof PROOF_MIMES)[number];
  ext: string;
}

/** Identify the image type from its magic bytes. */
export function detectImage(bytes: Uint8Array): DetectedImage | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) {
    return { mime: "image/png", ext: "png" };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // WEBP
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

/** Keep a readable original filename without control chars / path tricks. */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[/\\]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120);
  return cleaned || "proof";
}
