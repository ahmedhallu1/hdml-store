import { describe, expect, it } from "vitest";
import { inferBrand, inferCategory, reviewFlags } from "@/lib/categorize";

describe("inferCategory (real catalog names)", () => {
  const cases: Array<[string, string]> = [
    ["Oraimo Freepods 3C, True Wireless Earbuds IPX5-Water Resistant", "earbuds-headphones"],
    ["Anker USB-C Car Charger, 30W 2-Port Type-C Car Adapter", "chargers-power"],
    ["Kingston Datatraveler Se9 Gen 3-512GB - USB 3.2 Gen 1 -Gold", "storage-memory"],
    ["Canon Pixma G3470 Wireless Colour 3-In-1 Refillable Megatank Printer", "computer-peripherals"],
    ["Glass Screen Protector For Apple iPhone 11 - Clear", "cases-protection"],
    ["Electronic_Cable", "cables-adapters"],
    ["Tp-Link Re315 Ac1200 Mesh Wi-Fi Range Extender", "networking"],
    ["Force Backpack Unisex | 15.6-Inch Laptop | 100% Waterproof", "laptops-bags"],
    ["Nanlite Pavotube Ii Rgbww Led Light Tube Photography", "cameras-photography"],
    ["Camelion Fast Charger Bc-1002A With 4 X Batteries", "chargers-power"],
    ["Energizer Max Battery, Size Aa, Pack Of 2", "batteries"],
    ["Realme C67 8-256 Suny Oasis", "smartphones"],
    ["Dell Pc Optiplex 7020 Tower I5-4570 3.2Ghz 8GB 500GB", "computers"],
    ["Jbl Flip 7 - Portable Waterproof And Drop-Proof Speaker", "speakers-audio"],
  ];
  for (const [name, expected] of cases) {
    it(`${expected} ← "${name.slice(0, 45)}…"`, () => {
      expect(inferCategory(name).slug).toBe(expected);
    });
  }
  it("falls back to other", () => {
    const result = inferCategory("Bakku Stainless Steel Curved Tweezer");
    expect(result.slug).toBe("other");
  });
});

describe("inferBrand", () => {
  it("detects brands at word boundaries", () => {
    expect(inferBrand("Anker Soundcore Vi R50I").brand).toBe("Soundcore");
    expect(inferBrand("Kingston Datatraveler 512GB").brand).toBe("Kingston");
    expect(inferBrand("Tp-Link Re315 Extender").brand).toBe("TP-Link");
  });
  it("handles the Belkin'Soundform glued apostrophe", () => {
    expect(inferBrand("Belkin'Soundform Nano2 True Wireless Earbuds White").brand).toBe("Belkin");
  });
  it("returns null for unknown brands", () => {
    expect(inferBrand("Generic Usb Fan For Desk").brand).toBeNull();
  });
  it("does not match inside words", () => {
    // "Independent" contains no brand even though 'Dell'-like fragments exist elsewhere
    expect(inferBrand("Independent Cable Organizer").brand).toBeNull();
  });
});

describe("reviewFlags", () => {
  it("flags generic underscore names", () => {
    expect(reviewFlags("Electronic_Cable")).toContain("generic_name");
  });
  it("flags mojibake arabic", () => {
    expect(reviewFlags("³Ù…§¹© ³Ù„Ùƒùš Type C ª¹Ù…Ù„")).toContain("corrupted_text");
  });
  it("flags very short names", () => {
    expect(reviewFlags("Bixolon")).toContain("very_short_name");
  });
  it("passes clean names", () => {
    expect(reviewFlags("Anker Soundcore Vi R50I True Wireless Earbuds")).toEqual([]);
  });
});
