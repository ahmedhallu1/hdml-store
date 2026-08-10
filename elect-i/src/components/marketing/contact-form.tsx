"use client";

import { useActionState } from "react";
import { submitContactAction } from "@/server/actions/inquiry";
import type { Locale } from "@/i18n/config";
import { EMPTY_FORM_STATE, FormAlert, SubmitButton, type FormState } from "./form";
import { TextField, TextAreaField } from "@/components/ui/field";

export function ContactForm({
  lang,
  dict,
}: {
  lang: Locale;
  dict: {
    name: string;
    email: string;
    subject: string;
    message: string;
    messageHint: string;
    sendCta: string;
    sending: string;
    successTitle: string;
    errorTitle: string;
  };
}) {
  const [state, action] = useActionState<FormState, FormData>(
    submitContactAction.bind(null, lang),
    EMPTY_FORM_STATE,
  );

  if (state.ok) {
    return (
      <FormAlert tone="success" title={dict.successTitle}>
        <p>{state.message}</p>
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
        <TextField id="name" name="name" label={dict.name} autoComplete="name" error={e.name} required />
        <TextField
          id="email"
          name="email"
          type="email"
          label={dict.email}
          autoComplete="email"
          error={e.email}
          required
        />
      </div>
      <TextField id="subject" name="subject" label={dict.subject} error={e.subject} required />
      <TextAreaField
        id="message"
        name="message"
        label={dict.message}
        hint={dict.messageHint}
        rows={6}
        error={e.message}
        required
      />
      <SubmitButton pendingLabel={dict.sending} className="self-start">
        {dict.sendCta}
      </SubmitButton>
    </form>
  );
}
