/**
 * All monetary math happens in integer piasters (1 EGP = 100 piasters).
 * Values cross the DB boundary as numeric(12,2); they enter this module via
 * `toPiasters` and leave via `piastersToDecimalString`. Never do float math
 * on money outside this file.
 */

const MAX_PIASTERS = 9_999_999_999_99; // mirrors numeric(12,2)

export class MoneyError extends Error {}

/** Parse an EGP amount (string or number) into integer piasters. */
export function toPiasters(value: string | number): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new MoneyError(`Invalid amount: ${value}`);
    const p = Math.round(value * 100);
    if (Math.abs(p) > MAX_PIASTERS) throw new MoneyError(`Amount out of range: ${value}`);
    return p;
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
  if (total > BigInt(MAX_PIASTERS)) throw new MoneyError(`Amount out of range: "${value}"`);
  return sign * Number(total);
}

function assertPiasters(p: number): void {
  if (!Number.isSafeInteger(p)) throw new MoneyError(`Not an integer piaster amount: ${p}`);
}

/** "1224824" -> "12248.24" (for DB numeric columns). */
export function piastersToDecimalString(p: number): string {
  assertPiasters(p);
  const sign = p < 0 ? "-" : "";
  const abs = Math.abs(p);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${whole}.${frac}`;
}

/** "1224824" -> "12,248.24" (display, no currency). */
export function piastersToDisplay(p: number): string {
  assertPiasters(p);
  const sign = p < 0 ? "-" : "";
  const abs = Math.abs(p);
  const whole = Math.floor(abs / 100).toLocaleString("en-US");
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${whole}.${frac}`;
}

/** "1224824" -> "EGP 12,248.24". */
export function formatEgp(p: number): string {
  return `EGP ${piastersToDisplay(p)}`;
}

/** unit price x quantity, overflow-checked. */
export function lineAmount(unitPiasters: number, qty: number): number {
  assertPiasters(unitPiasters);
  if (!Number.isSafeInteger(qty) || qty < 1) throw new MoneyError(`Invalid quantity: ${qty}`);
  const amount = unitPiasters * qty;
  if (!Number.isSafeInteger(amount) || amount > MAX_PIASTERS) {
    throw new MoneyError(`Line amount out of range`);
  }
  return amount;
}

export function sumPiasters(values: number[]): number {
  let total = 0;
  for (const v of values) {
    assertPiasters(v);
    total += v;
    if (!Number.isSafeInteger(total) || total > MAX_PIASTERS) {
      throw new MoneyError("Total out of range");
    }
  }
  return total;
}

/**
 * Pick the applicable unit price for a quantity given wholesale tiers.
 * Tiers apply when qty >= min_qty; the highest qualifying min_qty wins.
 */
export function tieredUnitPrice(
  basePiasters: number,
  qty: number,
  tiers: Array<{ minQty: number; unitPricePiasters: number }>,
): number {
  assertPiasters(basePiasters);
  let best = basePiasters;
  let bestMin = 0;
  for (const t of tiers) {
    if (qty >= t.minQty && t.minQty > bestMin) {
      best = t.unitPricePiasters;
      bestMin = t.minQty;
    }
  }
  return best;
}
