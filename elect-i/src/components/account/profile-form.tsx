"use client";

import { useActionState } from "react";
import { updateProfileAction, type ProfileState } from "@/server/actions/profile";
import type { Locale } from "@/i18n/config";
import type { Account } from "@/lib/db-types";
import { TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export function ProfileForm({
  lang,
  account,
  dict,
}: {
  lang: Locale;
  account: Account;
  dict: {
    fullName: string;
    companyName: string;
    country: string;
    phone: string;
    phoneHint: string;
    vatNumber: string;
    vatHint: string;
    email: string;
    emailLocked: string;
    save: string;
    saving: string;
    saved: string;
    optional: string;
    genericError: string;
  };
}) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    updateProfileAction.bind(null, lang),
    {},
  );
  const errors = state.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4">
      {errors._form ? (
        <p role="alert" className="rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm text-danger-400">
          {errors._form}
        </p>
      ) : null}
      {state.saved ? (
        <p className="flex items-center gap-2 rounded-xl border border-settled-500/30 bg-settled-500/10 px-4 py-3 text-sm text-settled-400">
          <Icon name="check" className="size-4" />
          {dict.saved}
        </p>
      ) : null}

      {/* Email is identity here and is shared with the sibling store, so it is
          shown read-only rather than offered as an editable field. */}
      <TextField
        id="email"
        label={dict.email}
        hint={dict.emailLocked}
        defaultValue={account.email}
        readOnly
        disabled
      />

      <TextField
        id="fullName"
        name="fullName"
        label={dict.fullName}
        defaultValue={account.full_name}
        autoComplete="name"
        error={errors.fullName}
        required
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="companyName"
          name="companyName"
          label={dict.companyName}
          defaultValue={account.company_name ?? ""}
          autoComplete="organization"
          error={errors.companyName}
          optionalLabel={dict.optional}
        />
        <TextField
          id="companyCountry"
          name="companyCountry"
          label={dict.country}
          defaultValue={account.company_country ?? ""}
          autoComplete="country-name"
          error={errors.companyCountry}
          optionalLabel={dict.optional}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="phone"
          name="phone"
          type="tel"
          label={dict.phone}
          hint={dict.phoneHint}
          defaultValue={account.phone ?? ""}
          autoComplete="tel"
          error={errors.phone}
          optionalLabel={dict.optional}
        />
        <TextField
          id="vatNumber"
          name="vatNumber"
          label={dict.vatNumber}
          hint={dict.vatHint}
          defaultValue={account.vat_number ?? ""}
          error={errors.vatNumber}
          optionalLabel={dict.optional}
        />
      </div>

      <Button type="submit" disabled={pending} className="mt-1 self-start">
        {pending ? dict.saving : dict.save}
      </Button>
    </form>
  );
}
