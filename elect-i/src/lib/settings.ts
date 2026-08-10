import "server-only";
import { cache } from "react";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import {
  BASE_CURRENCY,
  isCurrencyCode,
  normaliseRates,
  type CurrencyCode,
  type CurrencyRates,
} from "@/lib/currency";

/**
 * Public pricing settings (`eig.settings` key `pricing_public`).
 *
 * That key is one of only two rows RLS exposes to anon and authenticated
 * clients, which is exactly why the display-currency table lives inside it
 * rather than in a new key: every visitor needs to read it on every page, and
 * no new policy or migration is required to let them.
 *
 * The row is read defensively. It predates this feature, so `currencies` and
 * `display_currency` may be absent, partial or junk; every shape resolves to
 * something renderable and, in the worst case, to plain USD.
 */

export const PRICING_PUBLIC_KEY = "pricing_public";

export interface PricingPublicSettings {
  /** Currency the catalogue is priced and transacted in. Always USD. */
  currency: string;
  /** Default display currency when the visitor's country tells us nothing. */
  display_currency: CurrencyCode;
  /** Per-currency conversion rules against USD. */
  currencies: CurrencyRates;
}

/** Fields we do not model but must not destroy when writing the row back. */
type UnknownFields = Record<string, unknown>;

function parse(value: unknown): PricingPublicSettings {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as UnknownFields)
      : {};
  const requested = raw.display_currency;
  const currencies = normaliseRates(raw.currencies);
  // An unknown or switched-off default silently degrades to USD rather than
  // showing a price at a rate nobody configured.
  const preferred = isCurrencyCode(requested) ? requested : BASE_CURRENCY;
  const display: CurrencyCode =
    preferred === BASE_CURRENCY || currencies[preferred].enabled ? preferred : BASE_CURRENCY;

  return {
    currency: typeof raw.currency === "string" ? raw.currency : BASE_CURRENCY,
    display_currency: display,
    currencies,
  };
}

/**
 * Read once per request. Every price on a catalogue page goes through this,
 * so 24 product cards must not mean 24 round trips.
 *
 * Read through the RLS-bound client: this row is public by policy and nothing
 * here needs the service role. A failure degrades to the safe defaults.
 */
export const getPricingPublic = cache(async (): Promise<PricingPublicSettings> => {
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", PRICING_PUBLIC_KEY)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return parse(data?.value ?? null);
  } catch (err) {
    console.error("settings: pricing_public read failed —", (err as Error).message);
    return parse(null);
  }
});

/**
 * Write the display-currency half of `pricing_public` back.
 *
 * Reads the stored row first with the service role and merges, so keys this
 * module does not model (today: `currency`) survive an edit. Callers MUST
 * have already authorised the write — this does not check.
 */
export async function saveDisplayCurrencySettings(next: {
  display_currency: CurrencyCode;
  currencies: CurrencyRates;
}): Promise<void> {
  const service = supabaseService();

  const { data, error: readError } = await service
    .from("settings")
    .select("value")
    .eq("key", PRICING_PUBLIC_KEY)
    .maybeSingle();
  if (readError) throw new Error(`Failed to read ${PRICING_PUBLIC_KEY}: ${readError.message}`);

  const existing =
    data?.value && typeof data.value === "object" && !Array.isArray(data.value)
      ? (data.value as UnknownFields)
      : {};

  const merged: UnknownFields = {
    ...existing,
    // The transacted currency is not editable here and is never touched.
    currency: typeof existing.currency === "string" ? existing.currency : BASE_CURRENCY,
    display_currency: next.display_currency,
    currencies: next.currencies,
  };

  const { error } = await service
    .from("settings")
    .upsert(
      { key: PRICING_PUBLIC_KEY, value: merged as never, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(`Failed to update ${PRICING_PUBLIC_KEY}: ${error.message}`);
}
