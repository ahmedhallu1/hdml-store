"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  forgotPasswordAction,
  registerAction,
  signInAction,
  updatePasswordAction,
  type AuthState,
} from "@/server/actions/auth";
import type { Locale } from "@/i18n/config";
import { TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

/** Shared shell so every auth form fails and succeeds the same way. */
function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm text-danger-400"
    >
      <Icon name="shield" className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-settled-500/30 bg-settled-500/10 px-4 py-3 text-sm text-settled-400">
      <Icon name="check" className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  );
}

/** Show/hide toggle so a long password can be checked before submitting. */
function PasswordField({
  id,
  name,
  label,
  hint,
  error,
  autoComplete,
  revealLabel,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  error?: string;
  autoComplete: string;
  revealLabel: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <TextField
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        label={label}
        hint={hint}
        error={error}
        autoComplete={autoComplete}
        required
        className="pr-12"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={revealLabel}
        aria-pressed={visible}
        className="absolute right-1 top-7 inline-flex size-11 cursor-pointer items-center justify-center rounded-lg text-ink-500 transition-colors hover:text-ink-200"
      >
        <svg viewBox="0 0 20 20" fill="none" className="size-5" aria-hidden="true">
          <path
            d="M1.8 10S4.6 4.6 10 4.6 18.2 10 18.2 10 15.4 15.4 10 15.4 1.8 10 1.8 10Z"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.4" />
          {visible ? <path d="m3.5 3.5 13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /> : null}
        </svg>
      </button>
    </div>
  );
}

export interface AuthDict {
  emailLabel: string;
  emailHint: string;
  passwordLabel: string;
  passwordHint: string;
  confirmPasswordLabel: string;
  fullNameLabel: string;
  companyLabel: string;
  signInCta: string;
  signingIn: string;
  registerCta: string;
  registering: string;
  checkEmailTitle: string;
  checkEmailBody: string;
  forgotCta: string;
  forgotSending: string;
  forgotSent: string;
  backToSignIn: string;
  newPassword: string;
  updatePasswordCta: string;
  updatingPassword: string;
  passwordUpdated: string;
  forgotPassword: string;
  optional: string;
  revealPassword: string;
}

export function SignInForm({
  lang,
  nextPath,
  dict,
}: {
  lang: Locale;
  nextPath: string | null;
  dict: AuthDict;
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signInAction.bind(null, lang, nextPath),
    {},
  );
  const errors = state.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={errors._form} />
      <TextField
        id="email"
        name="email"
        type="email"
        label={dict.emailLabel}
        autoComplete="email"
        error={errors.email}
        required
      />
      <PasswordField
        id="password"
        name="password"
        label={dict.passwordLabel}
        autoComplete="current-password"
        error={errors.password}
        revealLabel={dict.revealPassword}
      />
      <Link
        href={`/${lang}/forgot-password`}
        className="-mt-1 self-start text-sm text-accent-300 transition-colors hover:text-accent-200"
      >
        {dict.forgotPassword}
      </Link>
      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        {pending ? dict.signingIn : dict.signInCta}
      </Button>
    </form>
  );
}

export function RegisterForm({
  lang,
  nextPath,
  dict,
  terms,
}: {
  lang: Locale;
  nextPath: string | null;
  dict: AuthDict;
  terms: React.ReactNode;
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    registerAction.bind(null, lang, nextPath),
    {},
  );
  const errors = state.errors ?? {};

  if (state.done) {
    return (
      <div className="flex flex-col gap-4">
        <Notice>
          <span>
            <strong className="block text-ink-100">{dict.checkEmailTitle}</strong>
            {dict.checkEmailBody.replace("{email}", state.email ?? "")}
          </span>
        </Notice>
        <Link
          href={`/${lang}/login`}
          className="text-sm text-accent-300 transition-colors hover:text-accent-200"
        >
          {dict.backToSignIn}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={errors._form} />
      <TextField
        id="fullName"
        name="fullName"
        label={dict.fullNameLabel}
        autoComplete="name"
        error={errors.fullName}
        required
      />
      <TextField
        id="companyName"
        name="companyName"
        label={dict.companyLabel}
        autoComplete="organization"
        error={errors.companyName}
        optionalLabel={dict.optional}
      />
      <TextField
        id="email"
        name="email"
        type="email"
        label={dict.emailLabel}
        hint={dict.emailHint}
        autoComplete="email"
        error={errors.email}
        required
      />
      <PasswordField
        id="password"
        name="password"
        label={dict.passwordLabel}
        hint={dict.passwordHint}
        autoComplete="new-password"
        error={errors.password}
        revealLabel={dict.revealPassword}
      />
      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label={dict.confirmPasswordLabel}
        autoComplete="new-password"
        error={errors.confirmPassword}
        revealLabel={dict.revealPassword}
      />
      <p className="text-xs leading-relaxed text-ink-500">{terms}</p>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? dict.registering : dict.registerCta}
      </Button>
    </form>
  );
}

export function ForgotPasswordForm({ lang, dict }: { lang: Locale; dict: AuthDict }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    forgotPasswordAction.bind(null, lang),
    {},
  );
  const errors = state.errors ?? {};

  if (state.done) {
    return (
      <div className="flex flex-col gap-4">
        <Notice>{dict.forgotSent}</Notice>
        <Link
          href={`/${lang}/login`}
          className="text-sm text-accent-300 transition-colors hover:text-accent-200"
        >
          {dict.backToSignIn}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={errors._form} />
      <TextField
        id="email"
        name="email"
        type="email"
        label={dict.emailLabel}
        autoComplete="email"
        error={errors.email}
        required
      />
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? dict.forgotSending : dict.forgotCta}
      </Button>
      <Link
        href={`/${lang}/login`}
        className="self-start text-sm text-accent-300 transition-colors hover:text-accent-200"
      >
        {dict.backToSignIn}
      </Link>
    </form>
  );
}

export function UpdatePasswordForm({
  lang,
  dict,
  accountHref,
  accountLabel,
}: {
  lang: Locale;
  dict: AuthDict;
  accountHref: string;
  accountLabel: string;
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    updatePasswordAction.bind(null, lang),
    {},
  );
  const errors = state.errors ?? {};

  if (state.done) {
    return (
      <div className="flex flex-col gap-4">
        <Notice>{dict.passwordUpdated}</Notice>
        <Link
          href={accountHref}
          className="text-sm text-accent-300 transition-colors hover:text-accent-200"
        >
          {accountLabel}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={errors._form} />
      <PasswordField
        id="password"
        name="password"
        label={dict.newPassword}
        hint={dict.passwordHint}
        autoComplete="new-password"
        error={errors.password}
        revealLabel={dict.revealPassword}
      />
      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label={dict.confirmPasswordLabel}
        autoComplete="new-password"
        error={errors.confirmPassword}
        revealLabel={dict.revealPassword}
      />
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? dict.updatingPassword : dict.updatePasswordCta}
      </Button>
    </form>
  );
}
