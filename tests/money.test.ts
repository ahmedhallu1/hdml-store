import { describe, expect, it } from "vitest";
import {
  MoneyError,
  formatEgp,
  lineAmount,
  piastersToDecimalString,
  piastersToDisplay,
  sumPiasters,
  tieredUnitPrice,
  toPiasters,
} from "@/lib/money";

describe("toPiasters", () => {
  it("parses whole pounds", () => {
    expect(toPiasters("889")).toBe(88900);
    expect(toPiasters("0")).toBe(0);
  });
  it("parses decimals exactly", () => {
    expect(toPiasters("493.95")).toBe(49395);
    expect(toPiasters("194.01")).toBe(19401);
    expect(toPiasters("125.5")).toBe(12550);
  });
  it("parses numbers (DB numeric) safely", () => {
    expect(toPiasters(493.95)).toBe(49395);
    expect(toPiasters(4.35)).toBe(435); // classic float trap
    expect(toPiasters(138499)).toBe(13849900);
  });
  it("accepts thousands separators in strings", () => {
    expect(toPiasters("12,248.24")).toBe(1224824);
  });
  it("rejects garbage", () => {
    expect(() => toPiasters("abc")).toThrow(MoneyError);
    expect(() => toPiasters("12.3.4")).toThrow(MoneyError);
    expect(() => toPiasters("")).toThrow(MoneyError);
    expect(() => toPiasters(NaN)).toThrow(MoneyError);
    expect(() => toPiasters(Infinity)).toThrow(MoneyError);
  });
  it("rejects sub-piaster precision", () => {
    expect(() => toPiasters("10.123")).toThrow(MoneyError);
    expect(toPiasters("10.120000")).toBe(1012); // trailing zeros fine
  });
});

describe("formatting", () => {
  it("piastersToDecimalString", () => {
    expect(piastersToDecimalString(1224824)).toBe("12248.24");
    expect(piastersToDecimalString(500)).toBe("5.00");
    expect(piastersToDecimalString(7)).toBe("0.07");
  });
  it("piastersToDisplay adds separators", () => {
    expect(piastersToDisplay(3000000000)).toBe("30,000,000.00");
    expect(piastersToDisplay(1224824)).toBe("12,248.24");
  });
  it("formatEgp", () => {
    expect(formatEgp(88900)).toBe("EGP 889.00");
  });
  it("rejects non-integer piasters", () => {
    expect(() => piastersToDecimalString(10.5)).toThrow(MoneyError);
  });
});

describe("lineAmount / sumPiasters", () => {
  it("computes line totals", () => {
    expect(lineAmount(6600, 3)).toBe(19800); // 66.00 x 3 = 198.00 (sample receipt)
    expect(lineAmount(1399900, 1)).toBe(1399900);
  });
  it("rejects invalid quantities", () => {
    expect(() => lineAmount(100, 0)).toThrow(MoneyError);
    expect(() => lineAmount(100, -1)).toThrow(MoneyError);
    expect(() => lineAmount(100, 1.5)).toThrow(MoneyError);
  });
  it("sums the first sample receipt exactly", () => {
    // 198.00 + 837.00 + 582.03 + 13999.00 + 2135.73 + 12248.24 = 30000.00
    const amounts = [19800, 83700, 58203, 1399900, 213573, 1224824];
    expect(sumPiasters(amounts)).toBe(3000000);
  });
  it("guards overflow", () => {
    expect(() => lineAmount(999_999_999_99, 100000)).toThrow(MoneyError);
  });
});

describe("tieredUnitPrice", () => {
  const tiers = [
    { minQty: 10, unitPricePiasters: 9000 },
    { minQty: 50, unitPricePiasters: 8000 },
  ];
  it("uses base price below all tiers", () => {
    expect(tieredUnitPrice(10000, 1, tiers)).toBe(10000);
    expect(tieredUnitPrice(10000, 9, tiers)).toBe(10000);
  });
  it("applies best qualifying tier (inclusive boundary)", () => {
    expect(tieredUnitPrice(10000, 10, tiers)).toBe(9000);
    expect(tieredUnitPrice(10000, 49, tiers)).toBe(9000);
    expect(tieredUnitPrice(10000, 50, tiers)).toBe(8000);
    expect(tieredUnitPrice(10000, 5000, tiers)).toBe(8000);
  });
  it("works with no tiers", () => {
    expect(tieredUnitPrice(10000, 100, [])).toBe(10000);
  });
});
