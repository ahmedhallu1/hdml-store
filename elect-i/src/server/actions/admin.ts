"use server";

import { revalidatePath } from "next/cache";
import { auditLog, requireAdmin } from "@/lib/auth";
import { saveDisplayCurrencySettings } from "@/lib/settings";
import {
  BASE_CURRENCY,
  CONVERTIBLE_CURRENCY_CODES,
  isCurrencyCode,
  normaliseRates,
  type CurrencyCode,
  type CurrencyRates,
} from "@/lib/currency";
import {
  displayCurrencySchema,
  messageFor,
  type FieldErrors,
} from "@/lib/validation";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

/**
 * Platform administration actions.
 *
 * Authorisation is `requireAdmin` from `@/lib/auth` — the same gate the rest
 * of the app uses, checking `eig.admin_profiles` and 404ing rather than
 * admitting the area exists. A Server Action is a public POST endpoint, so
 * the check runs here and not only on the page that renders the form.
 */

export interface AdminState {
  errors?: FieldErrors;
  ok?: boolean;
}

/**
 * Map zod issues back onto the inputs that produced them. `rates.EGP` becomes
 * `rate_EGP`, which is the field name the form uses, so the message lands
 * under the box the admin typed in.
 */
function fieldErrorsFrom(
  issues: readonly { path: PropertyKey[]; message: string }[],
  validation: Record<string, string>,
  fallback: string,
): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of issues) {
    const [head, tail] = issue.path;
    const key =
      head === "rates" && typeof tail === "string"
        ? `rate_${tail}`
        : typeof head === "string"
          ? head
          : "_form";
    out[key] ??= messageFor(validation, issue.message, fallback);
  }
  return out;
}

export async function updateDisplayCurrencyAction(
  lang: Locale,
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const user = await requireAdmin(lang);
  const dict = await getDictionary(lang);
  const validation = dict.validation as unknown as Record<string, string>;
  const fallback = dict.errors.validation;

  const rates: Record<string, unknown> = {};
  const enabled: string[] = [];
  for (const code of CONVERTIBLE_CURRENCY_CODES) {
    rates[code] = String(formData.get(`rate_${code}`) ?? "");
    // An unchecked checkbox is simply absent from the payload.
    if (formData.get(`enabled_${code}`) !== null) enabled.push(code);
  }

  const parsed = displayCurrencySchema.safeParse({
    defaultCurrency: formData.get("defaultCurrency"),
    rates,
    enabled,
  });
  if (!parsed.success) {
    return { errors: fieldErrorsFrom(parsed.error.issues, validation, fallback) };
  }

  // Rebuild through normaliseRates so what is written is exactly the shape the
  // readers expect — the base currency pinned at 1, and no currency left
  // "enabled" without a usable rate.
  const draft: Record<string, { rate: number; enabled: boolean }> = {};
  for (const code of CONVERTIBLE_CURRENCY_CODES) {
    draft[code] = {
      rate: parsed.data.rates[code],
      enabled: parsed.data.enabled.includes(code),
    };
  }
  const currencies: CurrencyRates = normaliseRates(draft);

  // A default nobody can be shown is not a default. Fall back to the base
  // rather than storing a value the resolver would silently ignore.
  const requested: CurrencyCode = isCurrencyCode(parsed.data.defaultCurrency)
    ? parsed.data.defaultCurrency
    : BASE_CURRENCY;
  const defaultCurrency: CurrencyCode =
    requested === BASE_CURRENCY || currencies[requested].enabled ? requested : BASE_CURRENCY;

  try {
    await saveDisplayCurrencySettings({
      display_currency: defaultCurrency,
      currencies,
    });
  } catch (error) {
    console.error("admin: display currency save failed —", (error as Error).message);
    return { errors: { _form: dict.errors.generic } };
  }

  await auditLog("admin", user.id, "settings.display_currency.updated", "settings", "pricing_public", {
    display_currency: defaultCurrency,
    currencies,
  });

  // Every public page prices from this row, so nothing cached may survive it.
  revalidatePath("/", "layout");
  return { ok: true };
}
