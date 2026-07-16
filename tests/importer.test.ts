import { describe, expect, it } from "vitest";
import { deriveCatalog, parseCsv } from "../scripts/import-catalog";

describe("parseCsv", () => {
  it("parses quoted fields with commas and escaped quotes", () => {
    const rows = parseCsv('name,price\n"Cable, 2m ""Pro""",89.00\nPlain,12.00\n');
    expect(rows).toEqual([
      ["name", "price"],
      ['Cable, 2m "Pro"', "89.00"],
      ["Plain", "12.00"],
    ]);
  });
  it("handles CRLF and embedded newlines", () => {
    const rows = parseCsv('a,b\r\n"multi\nline",1\r\n');
    expect(rows).toEqual([
      ["a", "b"],
      ["multi\nline", "1"],
    ]);
  });
});

function rows(list: Array<[string, string]>) {
  return list.map(([name, priceDecimal]) => ({ name, priceDecimal }));
}

describe("deriveCatalog", () => {
  it("collapses exact duplicates and keeps the count", () => {
    const audit = deriveCatalog(
      rows([
        ["Widget Product Alpha", "100.00"],
        ["Widget Product Alpha", "100.00"],
        ["Widget Product Alpha", "100.00"],
        ["Widget Product Beta", "50.00"],
      ]),
    );
    expect(audit.products).toHaveLength(2);
    expect(audit.exactDuplicateRowsRemoved).toBe(2);
    const a = audit.products.find((p) => p.name === "Widget Product Alpha")!;
    expect(a.source_duplicate_count).toBe(3);
    expect(a.active).toBe(true);
  });

  it("keeps conflicting prices as separate inactive variants (never merges)", () => {
    const audit = deriveCatalog(
      rows([
        ["JBL Flip Seven Portable Speaker", "5400.00"],
        ["JBL Flip Seven Portable Speaker", "5698.00"],
      ]),
    );
    expect(audit.products).toHaveLength(2);
    expect(audit.conflictingNames).toHaveLength(1);
    for (const p of audit.products) {
      expect(p.active).toBe(false);
      expect(p.needs_review).toBe(true);
      expect(p.review_reason).toContain("conflicting_prices");
    }
    // distinct SKUs and slugs per variant
    const [p1, p2] = audit.products;
    expect(p1.sku).not.toBe(p2.sku);
    expect(p1.slug).not.toBe(p2.slug);
    expect(p2.slug).toMatch(/-2$/);
    // variants sorted by price ascending
    expect(p1.priceDecimal).toBe("5400.00");
  });

  it("flags generic and corrupted names as needs_review", () => {
    const audit = deriveCatalog(
      rows([
        ["Electronic_Cable", "119.00"],
        ["³Ù…§¹© Corrupted Product Name Here", "50.00"],
        ["Perfectly Normal Wireless Mouse Device", "150.00"],
      ]),
    );
    const generic = audit.products.find((p) => p.name === "Electronic_Cable")!;
    expect(generic.needs_review).toBe(true);
    expect(generic.review_reason).toContain("generic_name");
    const mojibake = audit.products.find((p) => p.name.includes("Corrupted"))!;
    expect(mojibake.needs_review).toBe(true);
    expect(mojibake.review_reason).toContain("corrupted_text");
    const clean = audit.products.find((p) => p.name.includes("Normal"))!;
    expect(clean.active).toBe(true);
    expect(clean.review_reason).toBeNull();
  });

  it("is deterministic (idempotent re-runs produce identical SKUs/slugs)", () => {
    const input = rows([
      ["Product One Alpha", "10.00"],
      ["Product One Alpha", "12.00"],
      ["Product Two Beta", "20.00"],
    ]);
    const a = deriveCatalog(input);
    const b = deriveCatalog(input);
    expect(a.products.map((p) => [p.sku, p.slug])).toEqual(b.products.map((p) => [p.sku, p.slug]));
  });

  it("computes audit statistics correctly", () => {
    const audit = deriveCatalog(
      rows([
        ["A Product Name Number One", "1.00"],
        ["A Product Name Number One", "1.00"],
        ["A Product Name Number One", "2.00"],
        ["B Product Name Number Two", "3.00"],
      ]),
    );
    expect(audit.sourceRows).toBe(4);
    expect(audit.distinctNames).toBe(2);
    expect(audit.distinctCombos).toBe(3);
    expect(audit.exactDuplicateRowsRemoved).toBe(1);
    expect(audit.activeCount).toBe(1);
    expect(audit.reviewCount).toBe(2);
  });
});
