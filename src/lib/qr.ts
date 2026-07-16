/**
 * QR code helper — renders payment numbers / tracking links as inline SVG in
 * HDML brand teal. SVG output means no binary handling and crisp rendering
 * at any size; embed the returned markup directly (it is machine-generated,
 * not user HTML).
 */

import "server-only";

export async function qrSvg(text: string): Promise<string> {
  // Dynamic import keeps `qrcode` out of bundles that never render a QR.
  const qrcode = await import("qrcode");
  return qrcode.toString(text, {
    type: "svg",
    margin: 1,
    width: 180,
    color: { dark: "#004754", light: "#ffffff" },
  });
}
