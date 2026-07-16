import "server-only";
import { getUser, isAdminUser } from "@/lib/auth";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB

export interface SniffedImage {
  ext: "jpg" | "png" | "webp";
  contentType: "image/jpeg" | "image/png" | "image/webp";
}

/** Identify JPEG/PNG/WebP by magic bytes; anything else is rejected. */
export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { ext: "png", contentType: "image/png" };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
}

/** Admin gate for upload route handlers. Returns the admin user id or null. */
export async function requireAdminForApi(): Promise<string | null> {
  const user = await getUser();
  if (!user) return null;
  return (await isAdminUser(user.id)) ? user.id : null;
}
