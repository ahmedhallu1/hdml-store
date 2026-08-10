"use client";

import { useActionState } from "react";
import { submitRfqAction } from "@/server/actions/inquiry";
import type { Locale } from "@/i18n/config";
import { EMPTY_FORM_STATE, FormAlert, SubmitButton, type FormState } from "./form";
import { TextField, TextAreaField, SelectField } from "@/components/ui/field";

/**
 * Client form for the quotation desk. It owns its own `useActionState` and
 * renders its fields inline — a server page cannot pass a render-prop function
 * across the RSC boundary, so each form that needs live field errors is its
 * own client component.
 */
export function QuoteForm({
  lang,
  tradeTerms,
  defaultDescription = "",
  defaultQty = "",
  dict,
}: {
  lang: Locale;
  tradeTerms: readonly string[];
  defaultDescription?: string;
  defaultQty?: string;
  dict: {
    itemsTitle: string;
    productDescription: string;
    itemsLead: string;
    itemPlaceholder: string;
    qty: string;
    logisticsTitle: string;
    destination: string;
    destinationHint: string;
    incoterm: string;
    noPreference: string;
    targetPrice: string;
    targetPriceHint: string;
    targetPricePlaceholder: string;
    contactTitle: string;
    yourName: string;
    workEmail: string;
    phone: string;
    companyName: string;
    optional: string;
    submitCta: string;
    sending: string;
    successTitle: string;
    errorTitle: string;
    referenceLabel: string;
  };
}) {
  const [state, action] = useActionState<FormState, FormData>(
    submitRfqAction.bind(null, lang),
    EMPTY_FORM_STATE,
  );

  if (state.ok) {
    return (
      <FormAlert tone="success" title={dict.successTitle}>
        <p>{state.message}</p>
        {state.reference ? (
          <p className="mt-2">
            <span className="text-ink-500">{dict.referenceLabel}: </span>
            <span className="font-mono text-accent-200">{state.reference}</span>
          </p>
        ) : null}
      </FormAlert>
    );
  }

  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.message ? (
        <FormAlert tone="error" title={dict.errorTitle}>
          <p>{state.message}</p>
        </FormAlert>
      ) : null}

      <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">{dict.itemsTitle}</h2>
      <TextAreaField
        id="productDescription"
        name="productDescription"
        label={dict.productDescription}
        hint={dict.itemsLead}
        placeholder={dict.itemPlaceholder}
        rows={4}
        defaultValue={defaultDescription}
        error={e.productDescription}
        required
      />
      <TextField
        id="qty"
        name="qty"
        type="number"
        min={1}
        label={dict.qty}
        defaultValue={defaultQty || undefined}
        error={e.qty}
        required
      />

      <h2 className="mt-2 text-sm font-bold uppercase tracking-wider text-ink-500">
        {dict.logisticsTitle}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="destinationCountry"
          name="destinationCountry"
          label={dict.destination}
          hint={dict.destinationHint}
          error={e.destinationCountry}
        />
        <SelectField id="incoterm" name="incoterm" label={dict.incoterm} defaultValue="">
          <option value="">{dict.noPreference}</option>
          {tradeTerms.map((term) => (
            <option key={term} value={term}>
              {term}
            </option>
          ))}
        </SelectField>
      </div>
      <TextField
        id="targetPrice"
        name="targetPrice"
        label={dict.targetPrice}
        hint={dict.targetPriceHint}
        placeholder={dict.targetPricePlaceholder}
      />

      <h2 className="mt-2 text-sm font-bold uppercase tracking-wider text-ink-500">
        {dict.contactTitle}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="contactName"
          name="contactName"
          label={dict.yourName}
          autoComplete="name"
          error={e.contactName}
          required
        />
        <TextField
          id="contactEmail"
          name="contactEmail"
          type="email"
          label={dict.workEmail}
          autoComplete="email"
          error={e.contactEmail}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="contactPhone"
          name="contactPhone"
          type="tel"
          label={dict.phone}
          autoComplete="tel"
          optionalLabel={dict.optional}
        />
        <TextField
          id="companyName"
          name="companyName"
          label={dict.companyName}
          autoComplete="organization"
          optionalLabel={dict.optional}
        />
      </div>

      <SubmitButton pendingLabel={dict.sending} className="self-start">
        {dict.submitCta}
      </SubmitButton>
    </form>
  );
}
