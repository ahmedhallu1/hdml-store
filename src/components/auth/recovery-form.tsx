"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/password-input";
import { Spinner } from "@/components/ui/spinner";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Phase = "checking" | "ready" | "invalid" | "saving" | "done";

/**
 * Password-recovery handler for the implicit (hash) flow.
 *
 * Supabase `admin.generateLink({type:'recovery'})` links redirect here with the
 * session in the URL fragment (`#access_token=…&type=recovery`). Fragments never
 * reach the server, so this runs entirely in the browser: the Supabase browser
 * client auto-detects the hash, establishes the recovery session, and we then
 * let the user set a new password with that session.
 */
export function RecoveryForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState<string | null>(null);
  const supabaseRef = useRef(supabaseBrowser());

  useEffect(() => {
    const supabase = supabaseRef.current;
    if (typeof window === "undefined") return;

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");

    // Explicit error in the hash (expired/used link) → invalid.
    if (hash.get("error")) {
      setPhase("invalid");
      return;
    }

    let cancelled = false;

    (async () => {
      // The @supabase/ssr (PKCE) client does not auto-parse implicit hash
      // tokens, so establish the recovery session explicitly from the fragment.
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!cancelled) {
          if (sessionError) {
            setPhase("invalid");
          } else {
            // Strip the tokens from the URL so they are not left in history.
            window.history.replaceState(null, "", window.location.pathname);
            setPhase("ready");
          }
        }
        return;
      }

      // No hash tokens: maybe a recovery session already exists (revisit).
      const { data } = await supabase.auth.getSession();
      if (!cancelled) setPhase(data.session ? "ready" : "invalid");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setPhase("saving");
    const { error: updateError } = await supabaseRef.current.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message || "Could not update the password. Please try again.");
      setPhase("ready");
      return;
    }
    setPhase("done");
    // The session is now a full session; the account area is reachable.
    router.push("/account");
    router.refresh();
  }

  if (phase === "checking") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-gray-500">
        <Spinner className="size-7" />
        <p className="text-sm">Verifying your reset link…</p>
      </div>
    );
  }

  if (phase === "invalid") {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
          This password reset link is invalid or has expired.
        </p>
        <p className="text-sm text-gray-600">
          Request a new link from the{" "}
          <Link href="/login" className="font-medium text-brand-700 hover:text-brand-600">
            sign-in page
          </Link>{" "}
          using “Forgot password?”.
        </p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <p role="status" className="text-sm font-medium text-emerald-700">
        Password updated ✓ Taking you to your account…
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
          {error}
        </p>
      )}
      <PasswordInput label="New password" name="password" autoComplete="new-password" required hint="At least 8 characters." />
      <PasswordInput label="Confirm new password" name="confirm" autoComplete="new-password" required />
      <Button type="submit" disabled={phase === "saving"} className="w-full">
        {phase === "saving" && <Spinner className="size-4 border-white/40 border-t-white" />}
        Save new password
      </Button>
    </form>
  );
}
