"use client";

import { useActionState, useState } from "react";
import { updateDisplayCurrencyAction, type AdminState } from "@/server/actions/admin";
import type { Locale } from "@/i18n/config";
import {
  BASE_CURRENCY,
  CONVERTIBLE_CURRENCY_CODES,
  CURRENCIES,
  convertUsdCents,
  formatCurrency,
  type CurrencyCode,
  type CurrencyRates,
} from "@/lib/currency";
import { TextField, SelectField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

/** The sample the live preview converts, so an admin sees the rounding. */
const PREVIEW_USD_CENTS = 100_00;

export interface CurrencyFormDict {
  defaultCurrency: string;
  defaultCurrencyHint: string;
  rate: string;
  rateHint: string;
  enabled: string;
  baseCurrency: string;
  preview: string;
  previewHint: string;
  save: string;
  saving: string;
  saved: string;
}

/**
 * Editor for the display-currency table.
 *
 * The preview beside each rate converts a fixed $100.00 through exactly the
 * same functions the catalogue uses, rounding included — so the effect of a
 * rate is visible before it is saved rather than discovered on a product page.
 */
export function CurrencyForm({
  lang,
  locale,
  defaultCurrency,
  rates,
  dict,
}: {
  lang: Locale;
  /** BCP-47 tag, so the preview matches what a visitor in this locale sees. */
  locale: string;
  defaultCurrency: CurrencyCode;
  rates: CurrencyRates;
  dict: CurrencyFormDict;
}) {
  const [state, action, pending] = useActionState<AdminState, FormData>(
    updateDisplayCurrencyAction.bind(null, lang),
    {},
  );
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      CONVERTIBLE_CURRENCY_CODES.map((code) => [
        code,
        rates[code].rate > 0 ? String(rates[code].rate) : "",
      ]),
    ),
  );
  const errors = state.errors ?? {};

  const preview = (code: CurrencyCode): string => {
    const rate = Number(draft[code]?.replace(/,/g, ""));
    if (!Number.isFinite(rate) || rate <= 0) return "—";
    return formatCurrency(convertUsdCents(PREVIEW_USD_CENTS, rate, code), code, locale);
  };

  return (
    <form action={action} className="flex flex-col gap-6">
      {errors._form ? (
        <p
          role="alert"
          className="rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-sm text-danger-400"
        >
          {errors._form}
        </p>
      ) : null}
      {state.ok ? (
        <p className="flex items-center gap-2 rounded-lg border border-settled-500/30 bg-settled-500/10 px-3 py-2 text-sm text-settled-400">
          <Icon name="check" className="size-4" />
          {dict.saved}
        </p>
      ) : null}

      <SelectField
        id="defaultCurrency"
        name="defaultCurrency"
        label={dict.defaultCurrency}
        hint={dict.defaultCurrencyHint}
        defaultValue={defaultCurrency}
        error={errors.defaultCurrency}
      >
        {[BASE_CURRENCY, ...CONVERTIBLE_CURRENCY_CODES].map((code) => (
          <option key={code} value={code}>
            {code} · {CURRENCIES[code].name}
          </option>
        ))}
      </SelectField>

      {/* The base currency is shown but not editable: it is the unit every
          stored amount is already in, and a rate of anything but 1 would be
          a contradiction rather than a setting. */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-200">
          <span className="font-mono">{BASE_CURRENCY}</span>
          <span className="font-normal text-ink-500">· {CURRENCIES[BASE_CURRENCY].name}</span>
        </p>
        <p className="mt-1 text-xs text-ink-500">{dict.baseCurrency}</p>
      </div>

      <div className="flex flex-col gap-5">
        {CONVERTIBLE_CURRENCY_CODES.map((code) => (
          <fieldset
            key={code}
            className="rounded-xl border border-white/8 bg-white/[0.02] p-4"
          >
            <legend className="px-1 text-sm font-semibold text-ink-200">
              <span className="font-mono">{code}</span>
              <span className="font-normal text-ink-500"> · {CURRENCIES[code].name}</span>
            </legend>

            <div className="mt-2 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <TextField
                id={`rate_${code}`}
                name={`rate_${code}`}
                label={dict.rate}
                hint={dict.rateHint.replaceAll("{currency}", code)}
                inputMode="decimal"
                autoComplete="off"
                value={draft[code] ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [code]: event.target.value }))
                }
                error={errors[`rate_${code}`]}
              />

              <div className="flex flex-col justify-end gap-3 sm:items-end">
                <p className="text-xs text-ink-500">
                  <span className="block font-semibold uppercase tracking-wider">
                    {dict.preview}
                  </span>
                  <span className="mt-1 block font-mono text-base tabular-nums text-ink-100">
                    {preview(code)}
                  </span>
                </p>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-300">
                  <input
                    type="checkbox"
                    name={`enabled_${code}`}
                    defaultChecked={rates[code].enabled}
                    className="size-4 cursor-pointer accent-accent-400"
                  />
                  {dict.enabled}
                </label>
              </div>
            </div>
          </fieldset>
        ))}
      </div>

      <p className="text-xs text-ink-500">
        {dict.previewHint.replaceAll(
          "{amount}",
          formatCurrency(PREVIEW_USD_CENTS, BASE_CURRENCY, locale),
        )}
      </p>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? dict.saving : dict.save}
      </Button>
    </form>
  );
}
