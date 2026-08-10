import { beforeAll, describe, expect, it } from "vitest";
import { itemsDigest as hdmlDigest, parseEigCreatedOrder } from "@/lib/eig/client";
// Deliberately reached across the workspace boundary: the whole point of these
// tests is that the two independent implementations cannot drift apart.
import { itemsDigest as eigDigest } from "../elect-i/src/lib/crypto";

const CLAIM_SECRET = "test-claim-secret-at-least-32-chars-long";
const REF = "I20260713175900";

beforeAll(() => {
  process.env.EIG_CLAIM_SECRET = CLAIM_SECRET;
});

/** What HDML sends as `external_items`, and what ELECT-I stores verbatim. */
const SNAPSHOT = [
  { sku: "HDML-001", name: "Anker PowerCore 20000", qty: 2, unitPriceCents: 3499, currency: "USD" },
  { sku: null, name: "Shipping adjustment", qty: 1, unitPriceCents: 500, currency: "USD" },
];

describe("itemsDigest agrees across HDML and ELECT-I", () => {
  it("produces the same digest over the same external snapshot", async () => {
    expect(await hdmlDigest(SNAPSHOT, REF, CLAIM_SECRET)).toBe(await eigDigest(SNAPSHOT, REF));
  });

  it("is independent of line order on both sides", async () => {
    const reversed = [...SNAPSHOT].reverse();
    expect(await hdmlDigest(reversed, REF, CLAIM_SECRET)).toBe(
      await hdmlDigest(SNAPSHOT, REF, CLAIM_SECRET),
    );
    expect(await eigDigest(reversed, REF)).toBe(await eigDigest(SNAPSHOT, REF));
  });

  it("ignores incidental formatting of the reference, sku case and name spacing", async () => {
    const messy = [
      { sku: "hdml-001", name: "  Anker   PowerCore 20000 ", qty: 2, unitPriceCents: 3499 },
      { sku: null, name: "SHIPPING ADJUSTMENT", qty: 1, unitPriceCents: 500 },
    ];
    expect(await eigDigest(messy, ` ${REF.toLowerCase()} `)).toBe(await eigDigest(SNAPSHOT, REF));
  });

  it("treats an omitted currency as USD, but seals a different one", async () => {
    const noCurrency = SNAPSHOT.map((i) => ({
      sku: i.sku,
      name: i.name,
      qty: i.qty,
      unitPriceCents: i.unitPriceCents,
    }));
    expect(await eigDigest(noCurrency, REF)).toBe(await eigDigest(SNAPSHOT, REF));

    const egp = SNAPSHOT.map((i) => ({ ...i, currency: "EGP" }));
    expect(await eigDigest(egp, REF)).not.toBe(await eigDigest(SNAPSHOT, REF));
  });

  it("changes when any priced field changes", async () => {
    const base = await eigDigest(SNAPSHOT, REF);
    const mutations = [
      SNAPSHOT.map((i, n) => (n === 0 ? { ...i, qty: 3 } : i)),
      SNAPSHOT.map((i, n) => (n === 0 ? { ...i, unitPriceCents: 3500 } : i)),
      SNAPSHOT.map((i, n) => (n === 0 ? { ...i, name: "Anker PowerCore 10000" } : i)),
      SNAPSHOT.map((i, n) => (n === 0 ? { ...i, sku: "HDML-002" } : i)),
    ];
    for (const mutated of mutations) {
      expect(await eigDigest(mutated, REF)).not.toBe(base);
    }
    expect(await eigDigest(SNAPSHOT, "I20260713175901")).not.toBe(base);
  });
});

describe("parseEigCreatedOrder", () => {
  const good = {
    order_id: "9d4b1f6e-2c3a-4f77-8f0a-1b2c3d4e5f60",
    order_number: "EIG-20260713-A7X2Q",
    claim_url: "https://elect-i-global.com/en/claim/abc123",
    status: "awaiting_recipient",
  };

  it("accepts a complete 201 body and ignores extra fields", () => {
    expect(parseEigCreatedOrder(good)).toEqual({
      ok: true,
      orderId: good.order_id,
      orderNumber: good.order_number,
      claimUrl: good.claim_url,
    });
  });

  it("rejects an empty or non-object body rather than inventing ids", () => {
    for (const payload of [{}, null, undefined, "created", 201, []]) {
      expect(parseEigCreatedOrder(payload).ok).toBe(false);
    }
  });

  it("rejects a body with no claim link — the buyer could never claim it", () => {
    const result = parseEigCreatedOrder({ ...good, claim_url: undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("claim_url");
  });

  it("rejects a claim link that is not a URL, and a blank order id", () => {
    expect(parseEigCreatedOrder({ ...good, claim_url: "not-a-url" }).ok).toBe(false);
    expect(parseEigCreatedOrder({ ...good, order_id: "" }).ok).toBe(false);
    expect(parseEigCreatedOrder({ ...good, order_number: null }).ok).toBe(false);
  });
});
