/**
 * Display currency (ELECT-I Global).
 *
 * Reached across the workspace boundary on purpose — the root suite is the
 * only vitest project in the repo, and these rules decide what a visitor is
 * quoted, so they are worth pinning down. Nothing here touches a stored or
 * transacted amount; the module under test cannot.
 */
import { describe, expect, it } from "vitest";
import {
  BASE_CURRENCY,
  CONVERTIBLE_CURRENCY_CODES,
  CURRENCIES,
  CURRENCY_CODES,
  DEFAULT_RATES,
  baseDisplayCurrency,
  convertUsdCents,
  currencyForCountry,
  enabledCurrencies,
  formatCurrency,
  formatDisplayPrice,
  isCurrencyCode,
  isKnownCountry,
  isUsableRate,
  normaliseRates,
  type CurrencyCode,
  type DisplayCurrency,
} from "../elect-i/src/lib/currency";

/* ── country → currency ─────────────────────────────────────────────────── */

describe("currencyForCountry", () => {
  it("gives Egyptian visitors EGP", () => {
    expect(currencyForCountry("EG")).toBe("EGP");
  });

  it("maps the Gulf countries we price for", () => {
    expect(currencyForCountry("SA")).toBe("SAR");
    expect(currencyForCountry("AE")).toBe("AED");
  });

  it("maps euro-area members, including Bulgaria and Croatia", () => {
    for (const country of ["DE", "FR", "IT", "ES", "NL", "IE", "HR", "BG"]) {
      expect(currencyForCountry(country)).toBe("EUR");
    }
  });

  it("maps the microstates and territories that circulate the euro", () => {
    for (const country of ["MC", "SM", "VA", "AD", "ME", "XK", "GP", "RE"]) {
      expect(currencyForCountry(country)).toBe("EUR");
    }
  });

  it("does not map EU members outside the euro area", () => {
    for (const country of ["PL", "CZ", "HU", "RO", "SE", "DK"]) {
      expect(currencyForCountry(country)).toBe("USD");
    }
  });

  it("falls back to USD for everywhere else", () => {
    for (const country of ["US", "GB", "CN", "JP", "IN", "NG", "BR"]) {
      expect(currencyForCountry(country)).toBe("USD");
    }
  });

  it("is case- and whitespace-insensitive", () => {
    expect(currencyForCountry("eg")).toBe("EGP");
    expect(currencyForCountry(" Eg ")).toBe("EGP");
  });

  it("treats Cloudflare's placeholders as no country at all", () => {
    // XX = unknown, T1 = Tor exit node; the rest are anonymiser pseudo-codes.
    for (const code of ["XX", "T1", "T2", "A1", "A2", "O1", "AP", "EU", "ZZ"]) {
      expect(isKnownCountry(code)).toBe(false);
      expect(currencyForCountry(code)).toBe("USD");
    }
  });

  it("survives a missing or malformed header", () => {
    for (const value of [null, undefined, "", "   ", "E", "EGY", "1G", "??"]) {
      expect(isKnownCountry(value)).toBe(false);
      expect(currencyForCountry(value)).toBe("USD");
    }
  });

  it("reports a real country as known, even when it maps to the base", () => {
    // The resolver relies on this: a US visitor's country ANSWERS the
    // question, so the settings default must not override it.
    expect(isKnownCountry("US")).toBe(true);
    expect(currencyForCountry("US")).toBe("USD");
  });
});

/* ── conversion + rounding ──────────────────────────────────────────────── */

describe("convertUsdCents", () => {
  it("leaves the base currency untouched", () => {
    expect(convertUsdCents(1_234_56, 1, "USD")).toBe(1_234_56);
    // Even a nonsense rate cannot move USD: it is the unit, not a conversion.
    expect(convertUsdCents(1_234_56, 99, "USD")).toBe(1_234_56);
  });

  it("converts USD cents into EGP piastres at the stored rate", () => {
    // $100.00 at 51 EGP/USD = 5,100 EGP = 510,000 piastres.
    expect(convertUsdCents(100_00, 51, "EGP")).toBe(510_000);
  });

  it("rounds EGP to whole pounds, never to piastres", () => {
    // $12.99 x 51 = 662.49 EGP. Displayed as a whole pound, not 662.49.
    const minor = convertUsdCents(12_99, 51, "EGP");
    expect(minor % 100).toBe(0);
    expect(minor).toBe(662_00);
    expect(formatCurrency(minor, "EGP", "en")).not.toMatch(/\./);
  });

  it("rounds SAR to 5 halalas and AED to 25 fils", () => {
    // The smallest denominations either currency actually circulates.
    expect(convertUsdCents(12_99, 3.75, "SAR") % CURRENCIES.SAR.stepMinor).toBe(0);
    expect(convertUsdCents(12_99, 3.6725, "AED") % CURRENCIES.AED.stepMinor).toBe(0);
    expect(convertUsdCents(12_99, 3.75, "SAR")).toBe(48_70); // 48.7125 -> 48.70
    expect(convertUsdCents(12_99, 3.6725, "AED")).toBe(47_75); // 47.706… -> 47.75
  });

  it("rounds EUR to the cent", () => {
    // $19.99 x 0.92 = 18.3908 -> 18.39
    expect(convertUsdCents(19_99, 0.92, "EUR")).toBe(18_39);
  });

  it("rounds half away from zero, symmetrically", () => {
    // 10.5 cents in each direction.
    expect(convertUsdCents(21, 0.5, "EUR")).toBe(11);
    expect(convertUsdCents(-21, 0.5, "EUR")).toBe(-11);
  });

  it("never renders a non-zero price as free", () => {
    // A fraction of a piastre still costs something; show the smallest unit.
    expect(convertUsdCents(1, 0.0001, "EGP")).toBe(100);
    expect(convertUsdCents(0, 51, "EGP")).toBe(0);
  });

  it("falls back to the USD amount rather than inventing one", () => {
    for (const rate of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1e12]) {
      expect(convertUsdCents(1_000, rate, "EGP")).toBe(1_000);
    }
    expect(convertUsdCents(Number.NaN, 51, "EGP")).toBe(0);
  });

  it("scales linearly, so a ladder keeps its shape", () => {
    const unit = convertUsdCents(4_10, 51, "EGP");
    const hundred = convertUsdCents(4_10 * 100, 51, "EGP");
    // Rounding is per-amount, so allow one step of drift across 100 units.
    expect(Math.abs(hundred - unit * 100)).toBeLessThanOrEqual(100 * 100);
  });
});

/* ── rates from settings ────────────────────────────────────────────────── */

describe("normaliseRates", () => {
  it("falls back to the seed rates when the setting has no currencies object", () => {
    const rates = normaliseRates(undefined);
    expect(rates.EGP.rate).toBe(DEFAULT_RATES.EGP.rate);
    expect(rates.EGP.enabled).toBe(true);
  });

  it("pins the base currency at 1 and always on", () => {
    const rates = normaliseRates({ USD: { rate: 7, enabled: false } });
    expect(rates[BASE_CURRENCY]).toEqual({ rate: 1, enabled: true });
  });

  it("disables a currency the owner switched off", () => {
    const rates = normaliseRates({ EGP: { rate: 51, enabled: false } });
    expect(rates.EGP.enabled).toBe(false);
    expect(enabledCurrencies(rates)).toEqual(["USD"]);
  });

  it("disables a currency whose rate is unusable, whatever the flag says", () => {
    for (const rate of [0, -3, "51", null, Number.NaN]) {
      const rates = normaliseRates({ EGP: { rate, enabled: true } });
      expect(rates.EGP.enabled).toBe(false);
      expect(rates.EGP.rate).toBe(0);
    }
  });

  it("treats junk as an absent currency rather than throwing", () => {
    for (const value of [null, "nonsense", 42, [], { EGP: "51" }, { EGP: [] }]) {
      const rates = normaliseRates(value);
      expect(rates[BASE_CURRENCY].rate).toBe(1);
      for (const code of CURRENCY_CODES) expect(typeof rates[code].enabled).toBe("boolean");
    }
  });

  it("keeps a missing `enabled` flag on, so adding a rate is enough", () => {
    expect(normaliseRates({ SAR: { rate: 3.75 } }).SAR.enabled).toBe(true);
  });

  it("always offers the base currency in the picker", () => {
    const rates = normaliseRates({});
    expect(enabledCurrencies(rates)[0]).toBe(BASE_CURRENCY);
  });
});

/* ── formatting ─────────────────────────────────────────────────────────── */

describe("formatCurrency", () => {
  it("prints USD the way the catalogue always has", () => {
    expect(formatCurrency(1_224_824, "USD", "en")).toBe("$12,248.24");
  });

  it("prints EGP without a fractional part", () => {
    const out = formatCurrency(5_100_00, "EGP", "en");
    expect(out).toMatch(/5,100/);
    expect(out).not.toMatch(/\.\d/);
  });

  it("uses the request locale", () => {
    // A Chinese reader is shown a disambiguated dollar sign.
    expect(formatCurrency(1_00, "USD", "zh-Hans")).not.toBe(formatCurrency(1_00, "USD", "en"));
  });

  it("keeps the sign on a negative amount", () => {
    expect(formatCurrency(-1_00, "USD", "en")).toMatch(/^-/);
  });

  it("degrades to a symbol rather than throwing on a bad locale", () => {
    expect(() => formatCurrency(1_00, "USD", "not-a-locale!!")).not.toThrow();
  });
});

describe("formatDisplayPrice", () => {
  const display = (code: CurrencyCode, rate: number): DisplayCurrency => ({
    code,
    rate,
    locale: "en",
    converted: code !== BASE_CURRENCY,
    source: "settings",
    available: [BASE_CURRENCY, code],
  });

  it("shows an Egyptian visitor pounds, not dollars", () => {
    const out = formatDisplayPrice(100_00, display("EGP", 51));
    expect(out).toMatch(/5,100/);
    expect(out).not.toMatch(/\$/);
  });

  it("shows a USD visitor exactly the catalogue price", () => {
    expect(formatDisplayPrice(100_00, display("USD", 1))).toBe("$100.00");
  });

  it("never emits a fraction the currency does not quote", () => {
    for (const code of CONVERTIBLE_CURRENCY_CODES) {
      const rate = DEFAULT_RATES[code].rate;
      for (const cents of [1, 99, 4_10, 12_99, 1_234_56]) {
        const minor = convertUsdCents(cents, rate, code);
        expect(minor % CURRENCIES[code].stepMinor).toBe(0);
        // e.g. "EGP 1,234.567" must never appear.
        const decimals = (formatCurrency(minor, code, "en").match(/\.(\d+)/)?.[1] ?? "").length;
        expect(decimals).toBeLessThanOrEqual(CURRENCIES[code].decimals);
      }
    }
  });
});

/* ── the safe answer ────────────────────────────────────────────────────── */

describe("baseDisplayCurrency", () => {
  it("is USD, unconverted, and says so", () => {
    const base = baseDisplayCurrency("en");
    expect(base.code).toBe("USD");
    expect(base.rate).toBe(1);
    expect(base.converted).toBe(false);
    expect(base.source).toBe("fallback");
  });
});

describe("isCurrencyCode / isUsableRate", () => {
  it("accepts only the five supported codes", () => {
    for (const code of CURRENCY_CODES) expect(isCurrencyCode(code)).toBe(true);
    for (const value of ["GBP", "usd", "", null, undefined, 51]) {
      expect(isCurrencyCode(value)).toBe(false);
    }
  });

  it("accepts only finite, positive, in-range rates", () => {
    for (const rate of [1, 0.92, 51, 1_000_000]) expect(isUsableRate(rate)).toBe(true);
    for (const rate of [0, -1, 1_000_001, Number.NaN, Infinity, "51", null]) {
      expect(isUsableRate(rate)).toBe(false);
    }
  });
});
