"use client";

import { useActionState } from "react";
import { updateProfile } from "@/server/actions/profile";
import type { AuthFormState } from "@/server/actions/auth";
import { GOVERNORATES } from "@/lib/egypt";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";

const initialState: AuthFormState = {};

export interface ProfileDefaults {
  fullName: string;
  phone: string;
  companyName: string;
  taxId: string;
  governorate: string;
  address: string;
}

export function ProfileForm({ defaults }: { defaults: ProfileDefaults }) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200"
        >
          {state.error}
        </p>
      )}
      {state.success && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200"
        >
          {state.success}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Full name"
          name="fullName"
          autoComplete="name"
          required
          defaultValue={defaults.fullName}
          error={state.fieldErrors?.fullName}
        />
        <TextField
          label="Mobile number"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="01012345678"
          required
          defaultValue={defaults.phone}
          error={state.fieldErrors?.phone}
        />
        <TextField
          label="Company name"
          name="companyName"
          autoComplete="organization"
          defaultValue={defaults.companyName}
          error={state.fieldErrors?.companyName}
        />
        <TextField
          label="Tax ID"
          name="taxId"
          defaultValue={defaults.taxId}
          hint="Optional — for tax invoices."
          error={state.fieldErrors?.taxId}
        />
        <SelectField
          label="Governorate"
          name="governorate"
          defaultValue={defaults.governorate}
          error={state.fieldErrors?.governorate}
        >
          <option value="">Select…</option>
          {GOVERNORATES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </SelectField>
        <div className="sm:col-span-2">
          <TextAreaField
            label="Delivery address"
            name="address"
            autoComplete="street-address"
            defaultValue={defaults.address}
            error={state.fieldErrors?.address}
          />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending && <Spinner className="size-4 border-white/40 border-t-white" />}
        Save profile
      </Button>
    </form>
  );
}
