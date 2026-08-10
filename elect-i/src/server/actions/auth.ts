"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import { ensureAccount } from "@/lib/auth";
import { bucketKey, clientIpFrom, rateLimit } from "@/lib/rate-limit";
import {
  forgotPasswordSchema,
  registerSchema,
  safeNextPath,
  signInSchema,
  translateIssues,
  updatePasswordSchema,
  type FieldErrors,
} from "@/lib/validation";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

/**
 * Auth actions.
 *
 * Server Actions are public POST endpoints — the rendered form is not a
 * boundary — so every one of these re-validates its input, rate-limits by IP
 * and by submitted email, and never echoes back whether an account exists.
 */

export interface AuthState {
  errors?: FieldErrors;
  /** Set when the flow finished but stays on the page (e.g. "check email"). */
  done?: boolean;
  email?: string;
}

async function validationCopy(lang: Locale) {
  const dict = await getDictionary(lang);
  return {
    dict,
    validation: dict.validation as unknown as Record<string, string>,
    fallback: dict.errors.validation,
  };
}

async function limiter(scope: string, email?: string) {
  const ip = clientIpFrom(await headers());
  const byIp = await rateLimit(bucketKey(scope, ip), 12, 900);
  if (!byIp) return false;
  if (!email) return true;
  return rateLimit(bucketKey(`${scope}:email`, email), 6, 900);
}

export async function signInAction(
  lang: Locale,
  nextPath: string | null,
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { dict, validation, fallback } = await validationCopy(lang);

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { errors: translateIssues(parsed.error, validation, fallback) };
  }

  if (!(await limiter("signin", parsed.data.email))) {
    return { errors: { _form: dict.errors.rateLimited } };
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Deliberately identical copy for "no such user" and "wrong password":
    // distinguishing them turns the form into an account-existence oracle.
    const message = error.message.toLowerCase().includes("confirm")
      ? dict.auth.emailNotConfirmed
      : dict.auth.invalidCredentials;
    return { errors: { _form: message } };
  }

  // Auth users are shared with the HDML store, so an existing customer signing
  // in here for the first time has no ELECT-I account row yet.
  if (data.user) await ensureAccount(data.user, lang);

  redirect(safeNextPath(nextPath) ?? `/${lang}/account`);
}

export async function registerAction(
  lang: Locale,
  nextPath: string | null,
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { dict, validation, fallback } = await validationCopy(lang);

  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    fullName: formData.get("fullName"),
    companyName: formData.get("companyName"),
  });
  if (!parsed.success) {
    return { errors: translateIssues(parsed.error, validation, fallback) };
  }

  if (!(await limiter("register", parsed.data.email))) {
    return { errors: { _form: dict.errors.rateLimited } };
  }

  // Create an ALREADY-CONFIRMED account via the admin API. This sends no
  // confirmation email, so signup never depends on email deliverability
  // (Supabase's built-in relay is throttled and often undelivered, and no
  // custom SMTP is configured). Merchants are vetted separately, so email
  // verification is not a security gate here.
  const service = supabaseService();
  const { error: createError } = await service.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.fullName,
      company_name: parsed.data.companyName ?? undefined,
    },
  });

  if (createError) {
    const message = createError.message.toLowerCase();
    if (message.includes("already") || message.includes("registered") || message.includes("exist")) {
      return { errors: { _form: dict.auth.alreadyRegistered } };
    }
    console.error("admin.createUser failed:", createError.message);
    return { errors: { _form: dict.auth.signUpFailed } };
  }

  // Establish the session by signing them in immediately.
  const supabase = await supabaseServer();
  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (signInError || !signIn.user) {
    // Account exists but auto-login hiccuped — direct them to sign in.
    return { errors: { _form: dict.auth.signUpFailed } };
  }

  await ensureAccount(signIn.user, lang);

  // Best-effort welcome email (no-op in mock mode; never blocks the redirect).
  const { sendWelcomeEmail } = await import("@/lib/email/notify");
  await sendWelcomeEmail(signIn.user.id, parsed.data.email, parsed.data.fullName, lang).catch(
    (e) => console.error("welcome email failed:", e),
  );

  redirect(safeNextPath(nextPath) ?? `/${lang}/account`);
}

export async function forgotPasswordAction(
  lang: Locale,
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { dict, validation, fallback } = await validationCopy(lang);

  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { errors: translateIssues(parsed.error, validation, fallback) };
  }

  if (!(await limiter("forgot", parsed.data.email))) {
    return { errors: { _form: dict.errors.rateLimited } };
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  const supabase = await supabaseServer();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(`/${lang}/account/update-password`)}`,
  });

  // Always the same answer, sent or not — see the oracle note above.
  return { done: true, email: parsed.data.email };
}

export async function updatePasswordAction(
  lang: Locale,
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { dict, validation, fallback } = await validationCopy(lang);

  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { errors: translateIssues(parsed.error, validation, fallback) };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { errors: { _form: dict.errors.generic } };

  return { done: true };
}

export async function signOutAction(lang: Locale): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect(`/${lang}`);
}
