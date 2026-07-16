"use client";

import { useActionState } from "react";
import { updatePassword, type AuthFormState } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PasswordInput } from "@/components/auth/password-input";

const initialState: AuthFormState = {};

export function ChangePasswordForm({
  submitLabel = "Change password",
}: {
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);

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

      <PasswordInput
        label="New password"
        name="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters."
        error={state.fieldErrors?.password}
      />
      <PasswordInput
        label="Confirm new password"
        name="confirm"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirm}
      />

      <Button type="submit" variant="secondary" disabled={pending}>
        {pending && <Spinner className="size-4" />}
        {submitLabel}
      </Button>
    </form>
  );
}
