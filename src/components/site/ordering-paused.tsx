"use client";

/**
 * "Ordering is stopped right now" panel + waiting-list signup.
 *
 * Rendered on the cart and checkout while `ordering.accepting_orders` is off.
 * Browsing is unaffected — only placing an order is blocked.
 */

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { TurnstileWidget, type TurnstileHandle } from "@/components/turnstile-widget";
import { subscribeToReopen } from "@/server/actions/reopen";

export function OrderingPaused({
  note,
  defaultEmail = "",
  className,
}: {
  note: string;
  defaultEmail?: string;
  className?: string;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileHandle>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await subscribeToReopen({ email, turnstileToken });
      setResult(res);
      if (!res.ok) {
        setTurnstileToken("");
        turnstileRef.current?.reset();
      }
    } catch {
      setResult({ ok: false, message: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="paused-heading"
      className={`rounded-xl border-2 border-amber-300 bg-amber-50 p-5 sm:p-6 ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="mt-0.5 size-6 shrink-0 text-amber-600"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M10 9v6M14 9v6" />
        </svg>
        <div className="min-w-0">
          <h2 id="paused-heading" className="text-base font-semibold text-amber-900">
            Ordering is stopped right now
          </h2>
          <p className="mt-1 text-sm text-amber-900">{note}</p>
        </div>
      </div>

      {result?.ok ? (
        <p role="status" className="mt-4 rounded-lg bg-white/70 px-4 py-3 text-sm font-medium text-emerald-800">
          {result.message}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="reopen-email" className="sr-only">
              Your email address
            </label>
            <input
              id="reopen-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="h-11 w-full rounded-lg border border-amber-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none sm:max-w-xs"
            />
            <Button type="submit" size="lg" disabled={busy || !turnstileToken || !email}>
              {busy && <Spinner className="size-4 border-white/40 border-t-white" />}
              {busy ? "Adding you…" : "Notify me when ordering reopens"}
            </Button>
          </div>

          <TurnstileWidget ref={turnstileRef} onToken={(t) => setTurnstileToken(t ?? "")} />

          {result && !result.ok && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {result.message}
            </p>
          )}
          <p className="text-xs text-amber-800">
            One email, only when we start taking orders again. Your cart stays saved.
          </p>
        </form>
      )}
    </section>
  );
}
