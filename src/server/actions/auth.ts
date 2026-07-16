"use server";

/**
 * Customer auth server actions: register, login, logout, password reset.
 *
 * Registration uses the service role admin API with email_confirm: true —
 * Supabase's built-in confirmation emails are too rate-limited for production,
 * so accounts are usable immediately. Turnstile + IP rate limits keep abuse
 * in check instead.
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import {
  forgotPasswordSchema,
  loginSchema,
  parseOrErrors,
  registerSchema,
  updatePasswordSchema,
} from "@/lib/validation";

export interface AuthFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
}

/** Only same-origin relative paths are allowed as post-auth destinations. */
function safeNextPath(raw: unknown): string {
  return typeof raw === "string" && /^\/(?!\/)/.test(raw) ? raw : "/";
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export async function register(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = parseOrErrors(registerSchema, {
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    companyName: formData.get("companyName") ?? "",
    turnstileToken: formData.get("turnstileToken"),
  });
  if (!parsed.ok) {
    return { error: "Please fix the highlighted fields.", fieldErrors: parsed.errors };
  }
  const input = parsed.data;

  const ip = clientIpFrom(await headers());
  if (!(await verifyTurnstile(input.turnstileToken, ip))) {
    return { error: "Human verification failed. Please try again." };
  }
  if (!(await rateLimit(`register:${ip}`, 5, 3600))) {
    return { error: "Too many registration attempts. Please try again in an hour." };
  }

  // Authorization for the service call: self-registration of a brand-new
  // account, gated by Turnstile + rate limit above.
  const service = supabaseService();
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });

  if (createError || !created?.user) {
    const message = createError?.message ?? "";
    if (
      createError?.code === "email_exists" ||
      /already.*(registered|exists)/i.test(message)
    ) {
      return {
        error: "An account with this email already exists. Try signing in instead.",
        fieldErrors: { email: "This email is already registered" },
      };
    }
    console.error("register createUser failed:", message);
    return { error: "We could not create your account. Please try again." };
  }

  // Sign in to set the session cookies for this browser.
  const supabase = await supabaseServer();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (signInError) {
    console.error("register sign-in failed:", signInError.message);
    return {
      error: "Your account was created but sign-in failed. Please sign in manually.",
    };
  }

  // Profile snapshot (authorized: we just created and signed in this user).
  const { error: profileError } = await service.from("customer_profiles").upsert({
    user_id: created.user.id,
    full_name: input.fullName,
    phone: input.phone,
    company_name: input.companyName || null,
  });
  if (profileError) {
    // Non-fatal: the account works; the profile can be completed in /account.
    console.error("register profile upsert failed:", profileError.message);
  }

  redirect(safeNextPath(formData.get("next")));
}

// ---------------------------------------------------------------------------
// Login / logout
// ---------------------------------------------------------------------------

export async function login(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = parseOrErrors(loginSchema, {
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.ok) {
    return { error: "Please enter your email and password.", fieldErrors: parsed.errors };
  }

  const ip = clientIpFrom(await headers());
  if (!(await rateLimit(`login:${ip}`, 20, 900))) {
    return { error: "Too many sign-in attempts. Please wait a few minutes and try again." };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { error: "Invalid email or password" };
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function logout(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

const GENERIC_RESET_MESSAGE =
  "If an account exists for that email, a password reset link is on its way.";

export async function requestPasswordReset(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = parseOrErrors(forgotPasswordSchema, { email: formData.get("email") });
  if (!parsed.ok) {
    return { error: "Please enter a valid email address." };
  }

  const ip = clientIpFrom(await headers());
  if (!(await rateLimit(`pwreset:${ip}`, 3, 3600))) {
    // Same generic message: no signal about accounts OR about limits.
    return { success: GENERIC_RESET_MESSAGE };
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  const supabase = await supabaseServer();
  // /auth/confirm exchanges the emailed code for a session, then forwards to
  // /account/update-password (which the proxy would otherwise bounce to /login,
  // dropping the code).
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent("/account/update-password")}`,
  });
  if (error) {
    // Log, but never reveal anything to the caller (no user enumeration).
    console.error("resetPasswordForEmail failed:", error.message);
  }
  return { success: GENERIC_RESET_MESSAGE };
}

export async function updatePassword(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await requireUser("/account");

  const parsed = parseOrErrors(updatePasswordSchema, {
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.ok) {
    return { error: "Please fix the highlighted fields.", fieldErrors: parsed.errors };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    console.error("updatePassword failed:", error.message);
    return { error: "Password could not be updated. Please try again." };
  }
  return { success: "Your password has been updated." };
}
