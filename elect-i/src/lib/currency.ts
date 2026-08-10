/**
 * Display currency: presentation only.
 *
 * The catalogue is priced in USD and every stored or transacted amount — an
 * order's `currency`/`total`/`amount_due`, payments, the wallet, invoices —
 * stays in the currency it was written in. Nothing in this file ever feeds a
 * charge. It converts a USD cent amount into a number a visitor can read in
 * their own currency, and says so on the page.
 *
 * Deliberately dependency-free (no `next`, no `@/…` alias, no `server-only`):
 * it is imported by server components, by client components and by the unit
 * tests, and it is reached across the workspace boundary from the root test
 * suite. Anything that touches cookies, headers or the database lives in
 * `display-currency.ts` instead.
 *
 * Internally every amount is an integer in *minor units* = 1/100 of the major
 * unit, for every currency — the same shape `money.ts` uses for USD cents.
 * `decimals` controls only how many fraction digits are printed.
 */

export const CURRENCY_CODES = ["USD", "EGP", "EUR", "SAR", "AED"] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

/** The currency the catalogue is priced in. Its rate is always exactly 1. */
export const BASE_CURRENCY: CurrencyCode = "USD";

/** Anything that has to be converted from the base, i.e. everything but USD. */
export type ConvertibleCurrencyCode = Exclude<CurrencyCode, "USD">;

export const CONVERTIBLE_CURRENCY_CODES: ConvertibleCurrencyCode[] = CURRENCY_CODES.filter(
  (code): code is ConvertibleCurrencyCode => code !== BASE_CURRENCY,
);

/** Cookie holding an explicit visitor choice. Read by `display-currency.ts`. */
export const CURRENCY_COOKIE = "eig_currency";

export interface CurrencyMeta {
  code: CurrencyCode;
  /** Fallback symbol, used only if `Intl` refuses the currency. */
  symbol: string;
  /** Fraction digits shown. EGP is quoted in whole pounds in the trade. */
  decimals: number;
  /**
   * Converted amounts are rounded to a whole multiple of this many minor
   * units, so a shelf price never lands on a fraction nobody quotes:
   * whole pounds for EGP, 5 halalas for SAR, 25 fils for AED — the smallest
   * denominations actually in circulation.
   */
  stepMinor: number;
  /** English name, for the picker and the admin editor. */
  name: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  USD: { code: "USD", symbol: "$", decimals: 2, stepMinor: 1, name: "US Dollar" },
  EGP: { code: "EGP", symbol: "E£", decimals: 0, stepMinor: 100, name: "Egyptian Pound" },
  EUR: { code: "EUR", symbol: "€", decimals: 2, stepMinor: 1, name: "Euro" },
  SAR: { code: "SAR", symbol: "SR", decimals: 2, stepMinor: 5, name: "Saudi Riyal" },
  AED: { code: "AED", symbol: "AED", decimals: 2, stepMinor: 25, name: "UAE Dirham" },
};

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (CURRENCY_CODES as readonly string[]).includes(value);
}

/* ── Country → currency ─────────────────────────────────────────────────── */

/**
 * Euro-area members plus the states and territories that use the euro as
 * their circulating currency. Bulgaria joined on 2026-01-01.
 */
const EURO_COUNTRIES = [
  // Members of the euro area.
  "AT", "BE", "BG", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT",
  "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES",
  // Monetary-agreement microstates.
  "AD", "MC", "SM", "VA",
  // Unilateral users.
  "ME", "XK",
  // French outermost regions and overseas collectivities on the euro.
  "GF", "GP", "MQ", "YT", "RE", "BL", "MF", "PM", "AX",
] as const;

const COUNTRY_CURRENCY: Record<string, CurrencyCode> = {
  EG: "EGP",
  SA: "SAR",
  AE: "AED",
  ...Object.fromEntries(EURO_COUNTRIES.map((c) => [c, "EUR" as CurrencyCode])),
};

/**
 * Placeholders Cloudflare and the GeoIP databases behind it return when the
 * country is unknown rather than absent: `XX` (unknown), `T1` (Tor exit),
 * and the MaxMind anonymiser pseudo-codes. All of them mean "no idea", so
 * they resolve to the base currency rather than to a guess.
 */
const UNKNOWN_COUNTRIES = new Set(["XX", "T1", "T2", "A1", "A2", "O1", "AP", "EU", "ZZ"]);

/**
 * True when the header carried a real ISO-3166 alpha-2 code.
 *
 * The distinction matters to the resolution order: a US visitor's country IS
 * known and settles the question at USD, while a visitor behind Tor has no
 * country at all and must fall through to the configured default.
 */
export function isKnownCountry(country: string | null | undefined): boolean {
  if (typeof country !== "string") return false;
  const code = country.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) && !UNKNOWN_COUNTRIES.has(code);
}

/**
 * Map a two-letter country (the `CF-IPCountry` header) to a display currency.
 * A missing, malformed or placeholder value yields USD — never a throw.
 */
export function currencyForCountry(country: string | null | undefined): CurrencyCode {
  if (!isKnownCountry(country)) return BASE_CURRENCY;
  return COUNTRY_CURRENCY[(country as string).trim().toUpperCase()] ?? BASE_CURRENCY;
}

/* ── Rates ──────────────────────────────────────────────────────────────── */

/** One currency's conversion rule: units of `code` per 1 USD. */
export interface CurrencyRate {
  rate: number;
  enabled: boolean;
}

export type CurrencyRates = Record<CurrencyCode, CurrencyRate>;

/** A rate is usable only if it is a finite, positive, in-range number. */
export const MAX_RATE = 1_000_000;

export function isUsableRate(rate: unknown): rate is number {
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0 && rate <= MAX_RATE;
}

/**
 * Seed rates, used only when the `pricing_public` setting carries no
 * `currencies` object at all (a database that predates this feature). The
 * owner edits the real ones in the admin currency editor; these exist so a
 * visitor in Cairo is not shown dollars because a settings row is missing.
 */
export const DEFAULT_RATES: CurrencyRates = {
  USD: { rate: 1, enabled: true },
  EGP: { rate: 51, enabled: true },
  EUR: { rate: 0.92, enabled: true },
  SAR: { rate: 3.75, enabled: true },
  AED: { rate: 3.6725, enabled: true },
};

/** Normalise anything stored in jsonb into a complete, safe rate table. */
export function normaliseRates(value: unknown): CurrencyRates {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
  // No `currencies` object at all: fall back to the seeds above.
  const source = raw ?? (DEFAULT_RATES as unknown as Record<string, unknown>);

  const out = {} as CurrencyRates;
  for (const code of CURRENCY_CODES) {
    if (code === BASE_CURRENCY) {
      // The base is definitionally 1 and can never be switched off.
      out[code] = { rate: 1, enabled: true };
      continue;
    }
    const entry = source[code];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      out[code] = { rate: 0, enabled: false };
      continue;
    }
    const { rate, enabled } = entry as { rate?: unknown; enabled?: unknown };
    const usable = isUsableRate(rate);
    out[code] = {
      rate: usable ? (rate as number) : 0,
      // A currency without a usable rate is off no matter what the flag says:
      // there is no honest number to show.
      enabled: usable && enabled !== false,
    };
  }
  return out;
}

/** Codes a visitor may actually be shown, base first. */
export function enabledCurrencies(rates: CurrencyRates): CurrencyCode[] {
  return CURRENCY_CODES.filter((code) => code === BASE_CURRENCY || rates[code].enabled);
}

/* ── Conversion ─────────────────────────────────────────────────────────── */

/**
 * USD cents → minor units of `code`, rounded to that currency's retail step.
 *
 * Rounding is half-up on the magnitude, so -1 and +1 of the same amount round
 * to mirrored values. A non-zero price never rounds down to zero: a $0.001
 * item shown in EGP is one pound, not "free".
 */
export function convertUsdCents(usdCents: number, rate: number, code: CurrencyCode): number {
  if (!Number.isFinite(usdCents)) return 0;
  if (code === BASE_CURRENCY) return Math.round(usdCents);
  if (!isUsableRate(rate)) return Math.round(usdCents);

  const step = CURRENCIES[code].stepMinor;
  const sign = usdCents < 0 ? -1 : 1;
  const raw = Math.abs(usdCents) * rate;
  let rounded = Math.round(raw / step) * step;
  if (rounded === 0 && raw > 0) rounded = step;
  return sign * rounded;
}

/* ── Formatting ─────────────────────────────────────────────────────────── */

/**
 * Minor units → a formatted string in the request locale.
 *
 * `Intl` is the whole implementation: it knows that a Chinese reader expects
 * "US$1,234.56" where an English one expects "$1,234.56", and it places the
 * Arabic symbols correctly. The manual fallback only runs if the runtime
 * rejects the currency, which no supported runtime does.
 */
export function formatCurrency(minor: number, code: CurrencyCode, locale: string): string {
  const meta = CURRENCIES[code];
  const value = minor / 100;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: meta.decimals,
      maximumFractionDigits: meta.decimals,
    }).format(value);
  } catch {
    const sign = value < 0 ? "-" : "";
    return `${sign}${meta.symbol}${Math.abs(value).toFixed(meta.decimals)}`;
  }
}

/* ── The resolved display currency ──────────────────────────────────────── */

/** Where the resolved currency came from, highest precedence first. */
export type CurrencySource = "cookie" | "country" | "settings" | "fallback";

/**
 * Everything a component needs to print a price. A plain object on purpose:
 * it crosses the server/client boundary as a prop, so it must serialise.
 */
export interface DisplayCurrency {
  code: CurrencyCode;
  /** Units of `code` per 1 USD. Always 1 for the base currency. */
  rate: number;
  /** BCP-47 tag the amount is formatted in. */
  locale: string;
  /** False for USD: nothing was converted, so no indicative note is shown. */
  converted: boolean;
  source: CurrencySource;
  /** Codes offered by the picker, base first. */
  available: CurrencyCode[];
}

/** The always-safe answer: the catalogue's own currency, unconverted. */
export function baseDisplayCurrency(locale: string): DisplayCurrency {
  return {
    code: BASE_CURRENCY,
    rate: 1,
    locale,
    converted: false,
    source: "fallback",
    available: [BASE_CURRENCY],
  };
}

/** USD cents → the visitor-facing string. The one call sites should use. */
export function formatDisplayPrice(usdCents: number, display: DisplayCurrency): string {
  return formatCurrency(
    convertUsdCents(usdCents, display.rate, display.code),
    display.code,
    display.locale,
  );
}
