import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { LOCALE_TAGS, type Locale } from "@/i18n/config";
import { getPricingPublic } from "@/lib/settings";
import {
  BASE_CURRENCY,
  CURRENCY_COOKIE,
  baseDisplayCurrency,
  currencyForCountry,
  enabledCurrencies,
  isCurrencyCode,
  isKnownCountry,
  type CurrencyCode,
  type CurrencySource,
  type DisplayCurrency,
} from "@/lib/currency";

/**
 * Resolve the currency a visitor's *browsing* prices are shown in.
 *
 * Order, highest first:
 *   1. an explicit choice they made in the picker (cookie),
 *   2. the country Cloudflare geolocated their IP to (`CF-IPCountry`),
 *   3. the default configured in settings,
 *   4. USD.
 *
 * A candidate only wins if it is enabled and has a usable rate; otherwise the
 * next rule gets its turn. Nothing here influences a charge — see
 * `currency.ts` for why that separation is absolute.
 */

/** The header Cloudflare adds to every request it proxies. */
const COUNTRY_HEADER = "cf-ipcountry";

async function readCookieChoice(): Promise<CurrencyCode | null> {
  try {
    const jar = await cookies();
    const value = jar.get(CURRENCY_COOKIE)?.value;
    return isCurrencyCode(value) ? value : null;
  } catch {
    return null;
  }
}

/** The visitor's country, or null when the edge could not determine one. */
export async function visitorCountry(): Promise<string | null> {
  try {
    const requestHeaders = await headers();
    const raw = requestHeaders.get(COUNTRY_HEADER);
    return isKnownCountry(raw) ? (raw as string).trim().toUpperCase() : null;
  } catch {
    // Not in a request scope (a statically rendered shell): no country.
    return null;
  }
}

export const resolveDisplayCurrency = cache(
  async (locale: Locale): Promise<DisplayCurrency> => {
    const tag = LOCALE_TAGS[locale] ?? LOCALE_TAGS.en;

    try {
      const settings = await getPricingPublic();
      const rates = settings.currencies;
      const available = enabledCurrencies(rates);

      const usable = (code: CurrencyCode | null): code is CurrencyCode =>
        code !== null && available.includes(code);

      const [chosen, country] = await Promise.all([readCookieChoice(), visitorCountry()]);

      const candidates: Array<[CurrencyCode | null, CurrencySource]> = [
        [chosen, "cookie"],
        // Only consult the country when the edge actually gave us one, so an
        // unknown origin falls through to the configured default instead of
        // being pinned to USD by the mapping's own fallback.
        [country === null ? null : currencyForCountry(country), "country"],
        [settings.display_currency, "settings"],
      ];

      for (const [code, source] of candidates) {
        if (!usable(code)) continue;
        return {
          code,
          rate: code === BASE_CURRENCY ? 1 : rates[code].rate,
          locale: tag,
          converted: code !== BASE_CURRENCY,
          source,
          available,
        };
      }

      return { ...baseDisplayCurrency(tag), available };
    } catch (err) {
      console.error("display currency: resolution failed —", (err as Error).message);
      return baseDisplayCurrency(tag);
    }
  },
);
