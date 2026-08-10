/**
 * All monetary math happens in integer USD cents. Values cross the DB
 * boundary as numeric(14,2); they enter via `toCents` and leave via
 * `centsToDecimalString`. Never do float math on money outside this file.
 *
 * Mirrors the HDML store's piaster module so the two codebases reason about
 * money identically — only the unit and symbol differ.
 */

const MAX_CENTS = 999_999_999_999_99; // mirrors numeric(14,2)

export class MoneyError extends Error {}

/** Parse a USD amount (string or number) into integer cents. */
export function toCents(value: string | number): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new MoneyError(`Invalid amount: ${value}`);
    const c = Math.round(value * 100);
    if (Math.abs(c) > MAX_CENTS) throw new MoneyError(`Amount out of range: ${value}`);
    return c;
  }
  const s = value.trim().replace(/,/g, "");
  const m = /^(-)?(\d+)(?:\.(\d{1,6}))?$/.exec(s);
  if (!m) throw new MoneyError(`Invalid amount: "${value}"`);
  const sign = m[1] ? -1 : 1;
  const whole = BigInt(m[2]);
  const fracRaw = (m[3] ?? "").padEnd(2, "0");
  if (fracRaw.length > 2 && Number(fracRaw.slice(2)) !== 0) {
    throw new MoneyError(`More than 2 decimal places: "${value}"`);
  }
  const frac = BigInt(fracRaw.slice(0, 2) || "0");
  const total = whole * 100n + frac;
  if (total > BigInt(MAX_CENTS)) throw new MoneyError(`Amount out of range: "${value}"`);
  return sign * Number(total);
}

function assertCents(c: number): void {
  if (!Number.isSafeInteger(c)) throw new MoneyError(`Not an integer cent amount: ${c}`);
}

/** 1224824 -> "12248.24" (for DB numeric columns). */
export function centsToDecimalString(c: number): string {
  assertCents(c);
  const sign = c < 0 ? "-" : "";
  const abs = Math.abs(c);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** 1224824 -> "12,248.24" (display, no currency symbol). */
export function centsToDisplay(c: number): string {
  assertCents(c);
  const sign = c < 0 ? "-" : "";
  const abs = Math.abs(c);
  const whole = Math.floor(abs / 100).toLocaleString("en-US");
  return `${sign}${whole}.${String(abs % 100).padStart(2, "0")}`;
}

/** 1224824 -> "$12,248.24". */
export function formatUsd(c: number): string {
  const sign = c < 0 ? "-" : "";
  return `${sign}$${centsToDisplay(Math.abs(c))}`;
}

/** unit price x quantity, overflow-checked. */
export function lineAmount(unitCents: number, qty: number): number {
  assertCents(unitCents);
  if (!Number.isSafeInteger(qty) || qty < 1) throw new MoneyError(`Invalid quantity: ${qty}`);
  const amount = unitCents * qty;
  if (!Number.isSafeInteger(amount) || amount > MAX_CENTS) {
    throw new MoneyError("Line amount out of range");
  }
  return amount;
}

export function sumCents(values: number[]): number {
  let total = 0;
  for (const v of values) {
    assertCents(v);
    total += v;
    if (!Number.isSafeInteger(total) || total > MAX_CENTS) {
      throw new MoneyError("Total out of range");
    }
  }
  return total;
}

/**
 * Apply a basis-point discount, rounding half-up to the nearest cent.
 * 1500 bps = 15%. Discounts never push a price below zero.
 */
export function applyDiscountBps(cents: number, bps: number): number {
  assertCents(cents);
  if (!Number.isSafeInteger(bps) || bps < 0 || bps > 10_000) {
    throw new MoneyError(`Invalid discount bps: ${bps}`);
  }
  const discounted = Math.round((cents * (10_000 - bps)) / 10_000);
  return Math.max(0, discounted);
}

/**
 * Convert EGP piasters to USD cents at the given rate (EGP per USD).
 * Used only by the catalog mirror; live orders are priced in USD directly.
 */
export function piastersToUsdCents(piasters: number, egpPerUsd: number): number {
  if (!Number.isFinite(egpPerUsd) || egpPerUsd <= 0) {
    throw new MoneyError(`Invalid FX rate: ${egpPerUsd}`);
  }
  assertCents(piasters);
  return Math.round(piasters / egpPerUsd);
}

/**
 * Pick the applicable unit price for a quantity given wholesale break tiers.
 * Tiers apply when qty >= minQty; the highest qualifying minQty wins.
 */
export function tieredUnitPrice(
  baseCents: number,
  qty: number,
  breaks: Array<{ minQty: number; unitPriceCents: number }>,
): number {
  assertCents(baseCents);
  let best = baseCents;
  let bestMin = 0;
  for (const t of breaks) {
    if (qty >= t.minQty && t.minQty > bestMin) {
      best = t.unitPriceCents;
      bestMin = t.minQty;
    }
  }
  return best;
}
