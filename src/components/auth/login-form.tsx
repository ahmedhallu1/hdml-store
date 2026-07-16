"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { login, type AuthFormState } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { PasswordInput } from "@/components/auth/password-input";
import { ForgotPassword } from "@/components/auth/forgot-password";
import { TurnstileWidget, type TurnstileHandle } from "@/components/turnstile-widget";

const initialState: AuthFormState = {};

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);
  const turnstileRef = useRef<TurnstileHandle>(null);

  // Tokens are single-use: get a fresh one after a failed attempt.
  useEffect(() => {
    if (state.error) turnstileRef.current?.reset();
  }, [state]);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next} />

        {notice && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
            {notice}
          </p>
        )}
        {state.error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200"
          >
            {state.error}
          </p>
        )}

        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={state.fieldErrors?.email}
        />
        <PasswordInput
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          error={state.fieldErrors?.password}
        />

        <TurnstileWidget ref={turnstileRef} onToken={() => {}} />

        <Button type="submit" disabled={pending} className="w-full">
          {pending && <Spinner className="size-4 border-white/40 border-t-white" />}
          Sign in
        </Button>
      </form>

      {/* Outside the login <form>: ForgotPassword contains its own form. */}
      <div className="flex items-start justify-between gap-4 text-sm">
        <ForgotPassword />
        <Link
          href={`/register?next=${encodeURIComponent(next)}`}
          className="font-medium text-brand-700 hover:text-brand-600"
        >
          Create an account
        </Link>
      </div>
    </div>
  );
}
