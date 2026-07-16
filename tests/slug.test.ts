import { describe, expect, it } from "vitest";
import { fnv1a64, productSku, slugify } from "@/lib/slug";

describe("slugify", () => {
  it("produces clean seo slugs", () => {
    expect(slugify("Anker Soundcore Vi R50I True Wireless Earbuds")).toBe(
      "anker-soundcore-vi-r50i-true-wireless-earbuds",
    );
  });
  it("strips apostrophes without splitting words", () => {
    expect(slugify("Belkin'Soundform Nano2")).toBe("belkinsoundform-nano2");
  });
  it("handles punctuation and parentheses", () => {
    expect(slugify("2-Pack (Orange) | 66% Off!")).toBe("2-pack-orange-66-off");
  });
  it("caps length without trailing dash", () => {
    const s = slugify("word ".repeat(50), 30);
    expect(s.length).toBeLessThanOrEqual(30);
    expect(s.endsWith("-")).toBe(false);
  });
  it("never returns empty", () => {
    expect(slugify("!!!")).toBe("product");
  });
});

describe("fnv1a64 / productSku", () => {
  it("is deterministic across calls", () => {
    expect(fnv1a64("hello")).toBe(fnv1a64("hello"));
    expect(productSku("JBL Flip 7", "5400.00")).toBe(productSku("JBL Flip 7", "5400.00"));
  });
  it("differs when price differs (conflicting-price variants)", () => {
    expect(productSku("JBL Flip 7", "5400.00")).not.toBe(productSku("JBL Flip 7", "5698.00"));
  });
  it("normalizes case/whitespace of the name", () => {
    expect(productSku("  JBL   Flip 7 ", "5400.00")).toBe(productSku("jbl flip 7", "5400.00"));
  });
  it("matches the HDML-XXXXXXXX format", () => {
    expect(productSku("Anything", "1.00")).toMatch(/^HDML-[A-Z0-9]{8}$/);
  });
});
