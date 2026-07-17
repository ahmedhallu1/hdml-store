"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/site/quantity-stepper";
import { useCart } from "@/lib/cart";

/**
 * Compact quantity + add-to-cart control for a product grid card. It lives
 * next to the card's link and must never trigger navigation, so pointer events
 * stop here and defaults are prevented.
 */
export function CardAddToCart({
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

  if (outOfStock) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 ring-1 ring-inset ring-gray-200">
        Out of stock
      </span>
    );
  }

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    add(productId, Math.max(moq, qty));
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div
      className="flex flex-col gap-2"
      onClick={(e) => e.preventDefault()}
    >
      <QuantityStepper value={qty} onChange={setQty} min={moq} size="sm" ariaLabel="Quantity" />
      <Button
        size="sm"
        className="w-full"
        onClick={handleAdd}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {added ? "Added ✓" : "Add"}
      </Button>
    </div>
  );
}
