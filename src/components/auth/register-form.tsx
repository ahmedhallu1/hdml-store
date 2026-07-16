"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { register, type AuthFormState } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { PasswordInput } from "@/components/auth/password-input";
import { TurnstileWidget, type TurnstileHandle } from "@/components/turnstile-widget";

const initialState: AuthFormState = {};

export function RegisterForm({ next }: { next: string }) {
  const turnstileRef = useRef<TurnstileHandle>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: AuthFormState, formData: FormData) => {
      const result = await register(prev, formData);
      // A returned state means failure (success redirects) — new challenge.
      turnstileRef.current?.reset();
      return result ?? initialState;
    },
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />

      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200"
        >
          {state.error}
        </p>
      )}

      <TextField
        label="Full name"
        name="fullName"
        autoComplete="name"
        required
        error={state.fieldErrors?.fullName}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
      />
      <TextField
        label="Mobile number"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="01012345678"
        required
        error={state.fieldErrors?.phone}
      />
      <TextField
        label="Company name"
        name="companyName"
        autoComplete="organization"
        hint="Optional — shown on your receipts."
        error={state.fieldErrors?.companyName}
      />
      <PasswordInput
        label="Password"
        name="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters."
        error={state.fieldErrors?.password}
      />

      <TurnstileWidget ref={turnstileRef} onToken={() => {}} />
      {state.fieldErrors?.turnstileToken && (
        <p role="alert" className="text-xs text-red-600">
          {state.fieldErrors.turnstileToken}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Spinner className="size-4 border-white/40 border-t-white" />}
        Create account
      </Button>

      <p className="text-sm text-gray-500">
        Already have an account?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-medium text-brand-700 hover:text-brand-600"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
