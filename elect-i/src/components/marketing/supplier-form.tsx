"use client";

import { useActionState } from "react";
import { submitSupplierAction } from "@/server/actions/inquiry";
import type { Locale } from "@/i18n/config";
import { EMPTY_FORM_STATE, FormAlert, SubmitButton, type FormState } from "./form";
import { TextField, TextAreaField } from "@/components/ui/field";

export function SupplierForm({
  lang,
  dict,
}: {
  lang: Locale;
  dict: {
    companyName: string;
    contactName: string;
    email: string;
    country: string;
    website: string;
    websiteOptional: string;
    productCategories: string;
    productCategoriesHint: string;
    message: string;
    messageOptional: string;
    submitCta: string;
    sending: string;
    successTitle: string;
    errorTitle: string;
    referenceLabel: string;
  };
}) {
  const [state, action] = useActionState<FormState, FormData>(
    submitSupplierAction.bind(null, lang),
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
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="companyName"
          name="companyName"
          label={dict.companyName}
          autoComplete="organization"
          error={e.companyName}
          required
        />
        <TextField
          id="contactName"
          name="contactName"
          label={dict.contactName}
          autoComplete="name"
          error={e.contactName}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="email"
          name="email"
          type="email"
          label={dict.email}
          autoComplete="email"
          error={e.email}
          required
        />
        <TextField
          id="country"
          name="country"
          label={dict.country}
          autoComplete="country-name"
          error={e.country}
          required
        />
      </div>
      <TextField
        id="website"
        name="website"
        type="url"
        label={dict.website}
        optionalLabel={dict.websiteOptional}
      />
      <TextAreaField
        id="productCategories"
        name="productCategories"
        label={dict.productCategories}
        hint={dict.productCategoriesHint}
        rows={3}
        error={e.productCategories}
        required
      />
      <TextAreaField
        id="message"
        name="message"
        label={dict.message}
        rows={3}
        optionalLabel={dict.messageOptional}
      />
      <SubmitButton pendingLabel={dict.sending} className="self-start">
        {dict.submitCta}
      </SubmitButton>
    </form>
  );
}
