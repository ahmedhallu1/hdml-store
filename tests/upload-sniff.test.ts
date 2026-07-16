import { describe, expect, it } from "vitest";
import { sniffImage } from "../src/app/api/admin/_lib/image-upload";

function bytes(...b: number[]): Uint8Array {
  return new Uint8Array(b);
}

describe("sniffImage (magic bytes)", () => {
  it("accepts JPEG / PNG / WebP signatures", () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))?.contentType).toBe("image/jpeg");
    expect(
      sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))?.contentType,
    ).toBe("image/png");
    const webp = new Uint8Array(16);
    webp.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
    webp.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
    expect(sniffImage(webp)?.contentType).toBe("image/webp");
  });

  it("rejects renamed non-images (the filename/extension is never trusted)", () => {
    // PDF magic
    expect(sniffImage(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBeNull();
    // HTML
    expect(sniffImage(new TextEncoder().encode("<html><script>x</script>"))).toBeNull();
    // GIF (not in the allow-list)
    expect(sniffImage(new TextEncoder().encode("GIF89a..."))).toBeNull();
    // empty / tiny
    expect(sniffImage(bytes())).toBeNull();
    expect(sniffImage(bytes(0xff))).toBeNull();
  });
});
