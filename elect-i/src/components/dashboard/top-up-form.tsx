"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { startTopUpAction, type DashboardState } from "@/server/actions/dashboard";
import type { Locale } from "@/i18n/config";
import { TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export function TopUpForm({
  lang,
  cardLabel,
  dict,
}: {
  lang: Locale;
  /** e.g. "VISA •••• 4261" — the card the charge will hit. */
  cardLabel: string | null;
  dict: {
    amount: string;
    hint: string;
    cta: string;
    pending: string;
    success: string;
    chargedTo: string;
    noCard: string;
  };
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<DashboardState, FormData>(
    startTopUpAction.bind(null, lang),
    {},
  );

  // A live gateway returns a redirect URL; otherwise the charge settles inline.
  useEffect(() => {
    if (state.ok && state.redirectUrl) window.location.href = state.redirectUrl;
    if (state.ok && state.settled) router.refresh();
  }, [state.ok, state.redirectUrl, state.settled, router]);

  const errors = state.errors ?? {};

  if (state.ok && state.settled) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-settled-500/30 bg-settled-500/10 p-4">
        <Icon name="check" className="mt-0.5 size-5 text-settled-400" />
        <div>
          <p className="font-semibold text-settled-400">{dict.success}</p>
          <p className="mt-0.5 text-sm text-ink-400">
            {dict.chargedTo} VISA •••• {state.last4}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {errors._form ? (
        <p role="alert" className="rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm text-danger-400">
          {errors._form}
        </p>
      ) : null}
      <TextField
        id="amount"
        name="amount"
        inputMode="decimal"
        label={dict.amount}
        hint={dict.hint}
        placeholder="500.00"
        error={errors.amount}
        required
      />
      {cardLabel ? (
        <p className="flex items-center gap-2 text-xs text-ink-500">
          <Icon name="wallet" className="size-3.5" />
          {dict.chargedTo} <span className="font-medium text-ink-300">{cardLabel}</span>
        </p>
      ) : (
        <p className="text-xs text-verify-300">{dict.noCard}</p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? dict.pending : dict.cta}
      </Button>
    </form>
  );
}
