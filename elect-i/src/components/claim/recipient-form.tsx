"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveDraftAction, submitClaimAction, type ActionState } from "@/server/actions/claim";
import type { RecipientDraft } from "@/lib/claim";
import type { Locale } from "@/i18n/config";
import { TextField, TextAreaField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export interface RecipientFormDict {
  title: string;
  lead: string;
  fullName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  address1: string;
  address2: string;
  postalCode: string;
  taxId: string;
  taxIdHint: string;
  notes: string;
  notesHint: string;
  optional: string;
  saved: string;
  saving: string;
  submitCta: string;
  submitting: string;
  validationError: string;
}

/**
 * One screen, no steps. The recipient has already been through a purchase
 * elsewhere; asking them to page through a wizard for an address they owe
 * nothing on is pure friction.
 *
 * Typing is autosaved on a debounce so closing the tab loses nothing.
 */
export function RecipientForm({
  token,
  lang,
  draft,
  dict,
}: {
  token: string;
  lang: Locale;
  draft: RecipientDraft | null;
  dict: RecipientFormDict;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    submitClaimAction.bind(null, token, lang),
    { ok: false },
  );

  const formRef = useRef<HTMLFormElement>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const scheduleSave = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const form = formRef.current;
      if (!form) return;
      setSaveState("saving");
      await saveDraftAction(token, new FormData(form));
      setSaveState("saved");
    }, 1200);
  };

  return (
    <section className="panel p-6 sm:p-7" aria-labelledby="recipient-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="recipient-heading" className="text-xl font-bold text-ink-50">
            {dict.title}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{dict.lead}</p>
        </div>
        {saveState !== "idle" ? (
          <span
            aria-live="polite"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-xs text-ink-500"
          >
            {saveState === "saving" ? (
              dict.saving
            ) : (
              <>
                <Icon name="check" className="size-3 text-settled-400" />
                {dict.saved}
              </>
            )}
          </span>
        ) : null}
      </div>

      <form ref={formRef} action={action} onInput={scheduleSave} className="mt-6 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="name"
            name="name"
            label={dict.fullName}
            defaultValue={draft?.name ?? ""}
            autoComplete="name"
            required
          />
          <TextField
            id="phone"
            name="phone"
            type="tel"
            label={dict.phone}
            defaultValue={draft?.phone ?? ""}
            autoComplete="tel"
            required
          />
        </div>

        <TextField
          id="email"
          name="email"
          type="email"
          label={dict.email}
          defaultValue={draft?.email ?? ""}
          autoComplete="email"
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="country"
            name="country"
            label={dict.country}
            defaultValue={draft?.country ?? ""}
            autoComplete="country-name"
            required
          />
          <TextField
            id="city"
            name="city"
            label={dict.city}
            defaultValue={draft?.city ?? ""}
            autoComplete="address-level2"
            required
          />
        </div>

        <TextField
          id="address1"
          name="address1"
          label={dict.address1}
          defaultValue={draft?.address1 ?? ""}
          autoComplete="address-line1"
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="address2"
            name="address2"
            label={dict.address2}
            defaultValue={draft?.address2 ?? ""}
            autoComplete="address-line2"
            optionalLabel={dict.optional}
          />
          <TextField
            id="postalCode"
            name="postalCode"
            label={dict.postalCode}
            defaultValue={draft?.postalCode ?? ""}
            autoComplete="postal-code"
            optionalLabel={dict.optional}
          />
        </div>

        <TextField
          id="taxId"
          name="taxId"
          label={dict.taxId}
          hint={dict.taxIdHint}
          defaultValue={draft?.taxId ?? ""}
          optionalLabel={dict.optional}
        />

        <TextAreaField
          id="notes"
          name="notes"
          label={dict.notes}
          hint={dict.notesHint}
          defaultValue={draft?.notes ?? ""}
          optionalLabel={dict.optional}
        />

        {state.error ? (
          <p role="alert" className="rounded-lg border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm text-danger-400">
            {dict.validationError}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={pending} className="mt-2 w-full sm:w-auto sm:self-start">
          {pending ? dict.submitting : dict.submitCta}
          {pending ? null : <Icon name="check" className="size-4" />}
        </Button>
      </form>
    </section>
  );
}
