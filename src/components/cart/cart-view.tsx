"use client";

/**
 * Cart page body. Quantities come from localStorage (useCart); product data
 * is re-fetched live from /api/cart-products. All prices here are previews —
 * the server re-computes everything at checkout.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCart } from "@/lib/cart";
import { fetchCartProducts, previewUnitPiasters, type CartProduct } from "@/lib/cart-products";
import { formatEgp, lineAmount, sumPiasters } from "@/lib/money";
import { publicImageUrl } from "@/lib/image-url";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/ui/spinner";
import { ProductPlaceholder } from "@/components/site/product-placeholder";

export function CartView({
  minOrderPiasters,
  vatNote,
}: {
  minOrderPiasters: number;
  vatNote: string;
}) {
  const { lines, ready, setQty, remove } = useCart();
  const [products, setProducts] = useState<Map<string, CartProduct> | null>(null);
  const [loadError, setLoadError] = useState(false);

  const idsKey = useMemo(() => lines.map((l) => l.productId).sort().join(","), [lines]);

  // Retry support: bumping the counter re-runs the fetch effect.
  const [loadAttempt, setLoadAttempt] = useState(0);
  const load = useCallback(() => setLoadAttempt((n) => n + 1), []);

  // Re-fetches only when the SET of products changes (not on qty steps).
  useEffect(() => {
    if (!ready) return;
    let stale = false;
    const ids = idsKey ? idsKey.split(",") : [];
    fetchCartProducts(ids)
      .then((map) => {
        if (stale) return;
        setProducts(map);
        setLoadError(false);
      })
      .catch(() => {
        if (!stale) setLoadError(true);
      });
    return () => {
      stale = true;
    };
  }, [ready, idsKey, loadAttempt]);

  // Quantities below the product's MOQ (e.g. stale localStorage after an MOQ
  // change) are bumped up automatically; the row explains what happened.
  useEffect(() => {
    if (!products) return;
    for (const l of lines) {
      const p = products.get(l.productId);
      if (p && l.qty < p.moq) setQty(l.productId, p.moq);
    }
  }, [products, lines, setQty]);

  if (!ready || (products === null && !loadError)) {
    return <PageLoading label="Loading your cart…" />;
  }

  if (loadError) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-gray-600">Your cart could not be loaded right now.</p>
        <Button variant="outline" className="mt-4" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="py-20 text-center">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mx-auto size-12 text-gray-300"
          aria-hidden
        >
          <circle cx="9" cy="20" r="1.4" />
          <circle cx="17" cy="20" r="1.4" />
          <path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.47 1.18h7.9a1.5 1.5 0 0 0 1.46-1.15L20.5 8H6" />
        </svg>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">Your cart is empty</h2>
        <p className="mt-1 text-sm text-gray-500">
          Browse the catalog and add products in bulk quantities.
        </p>
        <Link
          href="/catalog"
          className="mt-5 inline-flex items-center rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
        >
          Browse the catalog
        </Link>
      </div>
    );
  }

  const productMap = products ?? new Map<string, CartProduct>();
  const availableLines = lines.filter((l) => productMap.has(l.productId));
  const unavailableLines = lines.filter((l) => !productMap.has(l.productId));

  const lineTotals = availableLines.map((l) => {
    const p = productMap.get(l.productId)!;
    const qty = Math.max(l.qty, 1);
    const unit = previewUnitPiasters(p, qty);
    return { line: l, product: p, unit, total: lineAmount(unit, qty) };
  });
  const subtotal = sumPiasters(lineTotals.map((t) => t.total));
  const belowMin = subtotal < minOrderPiasters;
  const hasMoqIssue = lineTotals.some((t) => t.line.qty < t.product.moq);
  const canCheckout =
    !belowMin && unavailableLines.length === 0 && !hasMoqIssue && lineTotals.length > 0;
  const progress = Math.min(100, Math.round((subtotal / Math.max(minOrderPiasters, 1)) * 100));

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {unavailableLines.length > 0 && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <p className="font-medium">Some items are no longer available.</p>
            <p className="mt-1">Please remove them below to continue to checkout.</p>
          </div>
        )}

        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {lineTotals.map(({ line, product, unit, total }) => {
            const image = product.images?.[0];
            const moqIssue = line.qty < product.moq;
            return (
              <li key={line.productId} className="flex gap-4 p-4 sm:p-5">
                <Link
                  href={`/product/${product.slug}`}
                  className="block size-16 shrink-0 overflow-hidden rounded-lg border border-gray-100 sm:size-20"
                  tabIndex={-1}
                  aria-hidden
                >
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={publicImageUrl(image)}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <ProductPlaceholder icon={product.categories?.icon} className="size-full" />
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/product/${product.slug}`}
                        className="line-clamp-2 text-sm font-medium text-gray-900 hover:text-brand-700"
                      >
                        {product.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {formatEgp(unit)} each · MOQ {product.moq}
                      </p>
                      {product.stock_status === "out_of_stock" && (
                        <p className="mt-1 text-xs font-medium text-red-600">
                          Out of stock — this item will be rejected at checkout.
                        </p>
                      )}
                      {moqIssue && (
                        <p className="mt-1 text-xs font-medium text-amber-700" role="alert">
                          Minimum order quantity is {product.moq} — quantity was adjusted.
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-gray-900">
                      {formatEgp(total)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <QtyStepper
                      qty={line.qty}
                      moq={product.moq}
                      name={product.name}
                      onChange={(q) => setQty(line.productId, q)}
                    />
                    <button
                      type="button"
                      onClick={() => remove(line.productId)}
                      className="text-xs font-medium text-gray-400 underline-offset-2 hover:text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}

          {unavailableLines.map((line) => (
            <li key={line.productId} className="flex items-center justify-between gap-4 bg-red-50/40 p-4 sm:p-5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700">
                  This product is no longer available
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  It was removed from our catalog after you added it (qty {line.qty}).
                </p>
              </div>
              <Button variant="danger" size="sm" onClick={() => remove(line.productId)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </div>

      {/* Summary */}
      <aside aria-label="Order summary" className="lg:col-span-1">
        <div className="sticky top-20 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">Summary</h2>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">
                Subtotal ({lineTotals.length} item{lineTotals.length === 1 ? "" : "s"})
              </dt>
              <dd className="font-semibold text-gray-900">{formatEgp(subtotal)}</dd>
            </div>
          </dl>

          {/* Minimum-order progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs">
              <span className={belowMin ? "font-medium text-amber-700" : "text-gray-500"}>
                Minimum order {formatEgp(minOrderPiasters)}
              </span>
              <span className="text-gray-400">{progress}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progress towards the minimum order"
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100"
            >
              <div
                className={`h-full rounded-full transition-all ${belowMin ? "bg-amber-400" : "bg-brand-600"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            {belowMin && (
              <p className="mt-2 text-xs text-amber-700">
                Add {formatEgp(minOrderPiasters - subtotal)} more to reach the minimum order.
              </p>
            )}
          </div>

          {canCheckout ? (
            <Link
              href="/checkout"
              className="mt-5 flex h-11 w-full items-center justify-center rounded-lg bg-brand-700 text-sm font-medium text-white hover:bg-brand-600"
            >
              Proceed to checkout
            </Link>
          ) : (
            <Button className="mt-5 w-full" disabled>
              Proceed to checkout
            </Button>
          )}

          <p className="mt-3 text-xs text-gray-500">{vatNote}</p>
          <p className="mt-1 text-xs text-gray-400">
            Prices are recalculated at checkout from live catalog data.
          </p>
        </div>
      </aside>
    </div>
  );
}

function QtyStepper({
  qty,
  moq,
  name,
  onChange,
}: {
  qty: number;
  moq: number;
  name: string;
  onChange: (qty: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(qty);

  function commit() {
    const parsed = Number.parseInt(draft ?? "", 10);
    if (Number.isSafeInteger(parsed)) {
      onChange(Math.max(parsed, moq)); // clamp to MOQ
    }
    setDraft(null);
  }

  const btn =
    "flex size-8 items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-brand-700 disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className="inline-flex items-center rounded-lg border border-gray-300">
      <button
        type="button"
        onClick={() => onChange(Math.max(qty - 1, moq))}
        disabled={qty <= moq}
        aria-label={`Decrease quantity of ${name}`}
        className={`${btn} rounded-l-lg`}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={moq}
        step={1}
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        aria-label={`Quantity of ${name} (minimum ${moq})`}
        className="h-8 w-16 border-x border-gray-300 text-center text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => onChange(Math.max(qty + 1, moq))}
        aria-label={`Increase quantity of ${name}`}
        className={`${btn} rounded-r-lg`}
      >
        +
      </button>
    </div>
  );
}
