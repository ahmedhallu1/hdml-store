"use client";

/**
 * Inline "Forgot password?" flow: a small disclosure with an email form.
 * Always shows the same generic confirmation — no user enumeration.
 */

import { useActionState, useState } from "react";
import { requestPasswordReset, type AuthFormState } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";

const initialState: AuthFormState = {};

export function ForgotPassword() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="font-medium text-gray-500 hover:text-brand-700"
      >
        Forgot password?
      </button>

      {open && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          {state.success ? (
            <p role="status" className="text-sm text-emerald-700">
              {state.success}
            </p>
          ) : (
            <form action={formAction} className="space-y-3" noValidate>
              <TextField
                label="Your account email"
                name="email"
                type="email"
                autoComplete="email"
                required
                error={state.error}
                hint="We'll email you a link to set a new password."
              />
              <Button type="submit" size="sm" variant="secondary" disabled={pending}>
                {pending && <Spinner className="size-3.5" />}
                Send reset link
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
