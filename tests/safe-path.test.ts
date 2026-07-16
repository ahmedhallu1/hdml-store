import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-path";

describe("safeNextPath (open-redirect guard)", () => {
  it("allows normal same-origin paths", () => {
    expect(safeNextPath("/account")).toBe("/account");
    expect(safeNextPath("/order/abc?x=1")).toBe("/order/abc?x=1");
    expect(safeNextPath("/catalog?q=usb-c")).toBe("/catalog?q=usb-c");
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
  });

  it("rejects the backslash bypass (browsers treat \\ as /)", () => {
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("/\\/evil.com")).toBe("/");
    expect(safeNextPath("/a\\b")).toBe("/");
    // sanity: the attack actually works on the naive pattern
    expect(new URL("/\\evil.com", "https://hdml.example").hostname).toBe("evil.com");
  });

  it("rejects control characters, empties and monsters", () => {
    expect(safeNextPath("/a\u0000b")).toBe("/");
    expect(safeNextPath("/a\nb")).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath(42)).toBe("/");
    expect(safeNextPath("/" + "a".repeat(3000))).toBe("/");
  });

  it("honors a custom fallback", () => {
    expect(safeNextPath(null, "/account/update-password")).toBe("/account/update-password");
  });
});
