"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/site/quantity-stepper";
import { useCart } from "@/lib/cart";

/**
 * Quantity selector + Add-to-cart button on the product detail page.
 * Quantities start at the product's MOQ and cannot go below it (also
 * re-enforced server-side at checkout).
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
  const [qty, setQty] = useState(moq);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const valid = Number.isSafeInteger(qty) && qty >= moq;

  function handleAdd() {
    if (!valid || outOfStock) return;
    add(productId, qty);
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 5000);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div>
          <span className="block text-sm font-medium text-gray-700">Quantity</span>
          <div className="mt-1.5">
            <QuantityStepper
              value={qty}
              onChange={setQty}
              min={moq}
              disabled={outOfStock}
              size="md"
              ariaLabel="Quantity"
            />
          </div>
        </div>
        <Button onClick={handleAdd} disabled={outOfStock || !valid} className="h-11">
          Add to cart
        </Button>
      </div>

      {!outOfStock && !valid && (
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
