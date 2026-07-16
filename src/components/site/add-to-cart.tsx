"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";

/**
 * Quantity selector + Add-to-cart button. Quantities start at the product's
 * MOQ and cannot go below it (also re-enforced server-side at checkout).
 */
export function AddToCart({
  productId,
  moq,
  outOfStock = false,
}: {
  productId: string;
  moq: number;
  outOfStock?: boolean;
}) {
  const { add } = useCart();
  const inputId = useId();
  const [qty, setQty] = useState(String(moq));
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const parsed = Number.parseInt(qty, 10);
  const valid = Number.isSafeInteger(parsed) && parsed >= moq;

  function handleAdd() {
    if (!valid || outOfStock) return;
    add(productId, parsed);
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 5000);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div>
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
            Quantity
          </label>
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={moq}
            step={1}
            value={qty}
            disabled={outOfStock}
            onChange={(e) => setQty(e.target.value)}
            onBlur={() => {
              if (!valid) setQty(String(moq));
            }}
            className="mt-1.5 h-10 w-28 rounded-lg border border-gray-300 bg-white px-3 text-[15px] text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>
        <Button onClick={handleAdd} disabled={outOfStock || !valid} className="h-10">
          Add to cart
        </Button>
      </div>

      {!outOfStock && !valid && qty !== "" && (
        <p role="alert" className="text-xs text-red-600">
          Quantity must be at least {moq}.
        </p>
      )}

      {added && (
        <p role="status" className="text-sm font-medium text-emerald-700">
          Added ✓{" "}
          <Link href="/cart" className="underline hover:text-emerald-800">
            View cart
          </Link>
        </p>
      )}

      {outOfStock && (
        <p className="text-sm text-gray-500">
          This product is currently out of stock. Contact us to be notified when it returns.
        </p>
      )}
    </div>
  );
}
