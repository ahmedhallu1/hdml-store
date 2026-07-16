"use client";

/**
 * Client-side helper shared by the cart page and the checkout form:
 * fetches live product data for the localStorage cart lines from
 * POST /api/cart-products and prices lines with the wholesale tiers.
 * These prices are a PREVIEW — the server re-prices at checkout.
 */

import type { StockStatus } from "@/lib/db-types";
import { tieredUnitPrice, toPiasters } from "@/lib/money";

export interface CartProduct {
  id: string;
  slug: string;
  name: string;
  /** numeric(12,2) as JS number — convert via toPiasters(String(x)). */
  price: number;
  moq: number;
  stock_status: StockStatus;
  images: string[];
  sku: string;
  categories: { icon: string | null } | null;
  product_price_tiers: Array<{ min_qty: number; unit_price: number }>;
}

export async function fetchCartProducts(
  productIds: string[],
): Promise<Map<string, CartProduct>> {
  if (productIds.length === 0) return new Map();
  const res = await fetch("/api/cart-products", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productIds: productIds.slice(0, 200) }),
  });
  if (!res.ok) throw new Error(`cart-products failed (${res.status})`);
  const json = (await res.json()) as { products: CartProduct[] };
  return new Map(json.products.map((p) => [p.id, p]));
}

/** Tier-aware unit price preview, in piasters. */
export function previewUnitPiasters(product: CartProduct, qty: number): number {
  return tieredUnitPrice(
    toPiasters(String(product.price)),
    qty,
    (product.product_price_tiers ?? []).map((t) => ({
      minQty: t.min_qty,
      unitPricePiasters: toPiasters(String(t.unit_price)),
    })),
  );
}
