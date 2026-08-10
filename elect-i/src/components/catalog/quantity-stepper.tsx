"use client";

import Link from "next/link";
import { useState } from "react";
import { lineAmount, tieredUnitPrice } from "@/lib/money";
import { formatDisplayPrice, type DisplayCurrency } from "@/lib/currency";
import { Icon } from "@/components/ui/icon";
import type { PriceLadderRow } from "@/lib/catalog-shared";

/**
 * Quantity + the two order CTAs.
 *
 * The unit price shown here is a live PREVIEW computed from the ladder the
 * server already resolved for this visitor's tier. It is never sent back as an
 * input: the quantity travels in the URL and the server re-prices it. A client
 * that tampers with this component can only change the number in its own
 * viewport.
 */
export function QuantityStepper({
  moq,
  ladder,
  orderHref,
  quoteHref,
  display,
  labels,
}: {
  moq: number;
  ladder: PriceLadderRow[];
  orderHref: string;
  quoteHref: string;
  /**
   * Presentation only. The ladder stays in USD cents and the quantity travels
   * in the URL — the server re-prices the line whatever this component shows.
   */
  display: DisplayCurrency;
  labels: {
    qty: string;
    decrease: string;
    increase: string;
    unitPrice: string;
    lineTotal: string;
    addToOrder: string;
    requestQuote: string;
    perUnit: string;
    units: string;
  };
}) {
  const floor = Math.max(1, moq);
  const [qty, setQty] = useState(floor);

  const unitCents = tieredUnitPrice(
    ladder[0]?.yourCents ?? 0,
    qty,
    ladder.map((row) => ({ minQty: row.minQty, unitPriceCents: row.yourCents })),
  );
  const total = safeLineAmount(unitCents, qty);

  const step = (delta: number) => setQty((current) => clamp(current + delta, floor));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="product-qty" className="text-sm font-semibold text-ink-300">
            {labels.qty}
          </label>
          <div className="flex items-stretch overflow-hidden rounded-xl border border-white/12 bg-obsidian-800/70 focus-within:border-accent-400">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={qty <= floor}
              aria-label={labels.decrease}
              className="grid size-11 cursor-pointer place-items-center text-ink-300 transition-colors duration-200 hover:bg-white/8 hover:text-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
                <path d="M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <input
              id="product-qty"
              type="number"
              inputMode="numeric"
              min={floor}
              step={1}
              value={qty}
              onChange={(event) => setQty(clamp(Number(event.target.value), floor))}
              className="w-20 min-w-0 bg-transparent text-center font-mono text-[15px] tabular-nums text-ink-50 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => step(1)}
              aria-label={labels.increase}
              className="grid size-11 cursor-pointer place-items-center text-ink-300 transition-colors duration-200 hover:bg-white/8 hover:text-ink-50"
            >
              <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
                <path
                  d="M8 3v10M3 8h10"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <dl className="flex flex-1 flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">{labels.unitPrice}</dt>
            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-ink-50">
              {/* Keyed so the value re-mounts and replays the pulse on change. */}
              <span key={unitCents} className="value-pop inline-block">
                {formatDisplayPrice(unitCents, display)}
              </span>
              <span className="ml-1 text-xs font-normal text-ink-500">{labels.perUnit}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">{labels.lineTotal}</dt>
            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-accent-300">
              <span key={total} className="value-pop inline-block">
                {formatDisplayPrice(total, display)}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Link
          href={`${orderHref}&qty=${qty}`}
          className="glow-accent inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-500 to-accent-400 px-6 text-base font-bold text-obsidian-950 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:from-accent-400 hover:to-accent-300 active:scale-[0.98]"
        >
          {labels.addToOrder}
          <Icon name="arrow-right" className="size-4" />
        </Link>
        <Link
          href={`${quoteHref}&qty=${qty}`}
          className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/5 px-6 text-base font-semibold text-ink-100 backdrop-blur-sm transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-accent-400/40 hover:bg-white/10 active:scale-[0.98]"
        >
          {labels.requestQuote}
        </Link>
      </div>
    </div>
  );
}

function clamp(value: number, floor: number): number {
  if (!Number.isFinite(value)) return floor;
  // 1,000,000 units is well past any real wholesale line and keeps the
  // integer-cent line total inside the safe range.
  return Math.min(1_000_000, Math.max(floor, Math.round(value)));
}

function safeLineAmount(unitCents: number, qty: number): number {
  try {
    return lineAmount(unitCents, qty);
  } catch {
    return 0;
  }
}
