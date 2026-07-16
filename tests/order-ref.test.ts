import { describe, expect, it } from "vitest";
import { ORDER_REF_PATTERN, orderRef, receiptDate } from "@/lib/order-ref";

describe("orderRef", () => {
  it("matches the receipt format I + 14 digits", () => {
    expect(orderRef()).toMatch(ORDER_REF_PATTERN);
  });
  it("renders Cairo local time (winter, UTC+2)", () => {
    // 2026-01-15 10:00 UTC = 12:00 Cairo (no DST in January)
    expect(orderRef(new Date("2026-01-15T10:00:00Z"))).toBe("I20260115120000");
  });
  it("bumps seconds for collision retries", () => {
    const base = new Date("2026-01-15T10:00:00Z");
    expect(orderRef(base, 1)).toBe("I20260115120001");
    expect(orderRef(base, 61)).toBe("I20260115120101");
  });
  it("rolls over midnight correctly", () => {
    // 22:30 UTC = 00:30 Cairo next day (winter)
    expect(orderRef(new Date("2026-01-15T22:30:00Z"))).toBe("I20260116003000");
  });
});

describe("receiptDate", () => {
  it("formats dd/mm/yyyy like the samples", () => {
    expect(receiptDate(new Date("2026-01-15T10:00:00Z"))).toBe("15/01/2026");
  });
});
