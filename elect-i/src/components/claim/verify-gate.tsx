"use client";

import { useActionState } from "react";
import { verifyReferenceAction, type ActionState } from "@/server/actions/claim";
import type { Locale } from "@/i18n/config";
import { TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

/**
 * The recipient proves they are the intended person by typing the reference
 * of the order they placed upstream. The token alone opens nothing — it only
 * identifies which order is being claimed.
 */
export function VerifyGate({
  token,
  lang,
  orderNumber,
  dict,
}: {
  token: string;
  lang: Locale;
  orderNumber: string;
  dict: {
    kicker: string;
    title: string;
    lead: string;
    label: string;
    placeholder: string;
    cta: string;
    error: string;
    locked: string;
    orderLabel: string;
  };
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    verifyReferenceAction.bind(null, token, lang),
    { ok: false },
  );

  const errorMessage =
    state.error === "locked"
      ? dict.locked.replace("{minutes}", String(state.retryInMinutes ?? 15))
      : state.error
        ? dict.error
        : undefined;

  return (
    <div className="mx-auto max-w-md">
      <div className="panel p-7 sm:p-8">
        <span className="inline-flex size-12 items-center justify-center rounded-xl border border-accent-400/25 bg-accent-500/10 text-accent-300">
          <Icon name="shield" />
        </span>

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-accent-400">
          {dict.kicker}
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-50">{dict.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-400">{dict.lead}</p>

        <p className="mt-4 flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
          <span className="text-xs text-ink-500">{dict.orderLabel}</span>
          <span className="font-mono text-sm text-ink-200">{orderNumber}</span>
        </p>

        <form action={action} className="mt-6 flex flex-col gap-4">
          <TextField
            id="reference"
            name="reference"
            label={dict.label}
            placeholder={dict.placeholder}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            error={errorMessage}
          />
          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {dict.cta}
            {pending ? null : <Icon name="arrow-right" className="size-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
