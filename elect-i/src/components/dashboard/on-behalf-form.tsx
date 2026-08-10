"use client";

import { useActionState, useState } from "react";
import { createOnBehalfAction, type DashboardState } from "@/server/actions/dashboard";
import type { Locale } from "@/i18n/config";
import { TextField, TextAreaField, SelectField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { CopyButton } from "./copy-button";

export interface OnBehalfDict {
  externalRef: string;
  externalRefHint: string;
  lines: string;
  sku: string;
  qty: string;
  addLine: string;
  removeLine: string;
  payFrom: string;
  payWallet: string;
  payCredit: string;
  recipientEmail: string;
  recipientHint: string;
  note: string;
  optional: string;
  submit: string;
  submitting: string;
  createdTitle: string;
  createdBody: string;
  claimLink: string;
  copy: string;
  copied: string;
  createAnother: string;
  orderNumber: string;
}

let nextRowId = 1;

export function OnBehalfForm({
  lang,
  canUseCredit,
  dict,
}: {
  lang: Locale;
  canUseCredit: boolean;
  dict: OnBehalfDict;
}) {
  const [state, action, pending] = useActionState<DashboardState, FormData>(
    createOnBehalfAction.bind(null, lang),
    {},
  );
  const [rows, setRows] = useState<number[]>([0]);
  const errors = state.errors ?? {};

  if (state.ok && state.claimUrl) {
    return (
      <div className="panel border-settled-500/30 p-6 sm:p-7">
        <span className="inline-flex size-11 items-center justify-center rounded-xl bg-settled-500/15 text-settled-400">
          <Icon name="check" className="size-5" />
        </span>
        <h3 className="mt-4 text-lg font-bold text-ink-50">{dict.createdTitle}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{dict.createdBody}</p>

        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-500">{dict.orderNumber}</span>
          <span className="font-mono text-ink-200">{state.orderNumber}</span>
        </p>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
            {dict.claimLink}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-obsidian-900/60 p-2.5">
            <code className="min-w-0 flex-1 break-all font-mono text-xs text-accent-200">
              {state.claimUrl}
            </code>
            <CopyButton value={state.claimUrl} label={dict.copy} copiedLabel={dict.copied} />
          </div>
        </div>

        <Button
          variant="secondary"
          className="mt-6"
          onClick={() => window.location.reload()}
        >
          {dict.createAnother}
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="panel flex flex-col gap-5 p-6 sm:p-7">
      {errors._form ? (
        <p role="alert" className="rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm text-danger-400">
          {errors._form}
        </p>
      ) : null}

      <TextField
        id="externalRef"
        name="externalRef"
        label={dict.externalRef}
        hint={dict.externalRefHint}
        placeholder="I20260713175900"
        autoCapitalize="characters"
        spellCheck={false}
        error={errors.externalRef}
        required
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-ink-300">{dict.lines}</legend>
        {rows.map((rowId, index) => (
          <div key={rowId} className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <TextField
                id={`sku-${rowId}`}
                name="sku"
                label={dict.sku}
                placeholder="EIG-4A7C21B9"
                autoCapitalize="characters"
                spellCheck={false}
                required={index === 0}
              />
            </div>
            <div className="w-24 shrink-0">
              <TextField
                id={`qty-${rowId}`}
                name="qty"
                type="number"
                min={1}
                defaultValue={1}
                label={dict.qty}
                required={index === 0}
              />
            </div>
            <button
              type="button"
              onClick={() => setRows((r) => (r.length > 1 ? r.filter((id) => id !== rowId) : r))}
              disabled={rows.length === 1}
              aria-label={dict.removeLine}
              className="mb-0.5 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/10 text-ink-500 transition-colors hover:border-danger-500/40 hover:text-danger-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
                <path d="M5 10h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
        {errors.lines ? (
          <p role="alert" className="text-xs text-danger-400">
            {errors.lines}
          </p>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setRows((r) => [...r, nextRowId++])}
        >
          <Icon name="spark" className="size-4" />
          {dict.addLine}
        </Button>
      </fieldset>

      <SelectField id="payFrom" name="payFrom" label={dict.payFrom} defaultValue="wallet">
        <option value="wallet">{dict.payWallet}</option>
        {canUseCredit ? <option value="credit">{dict.payCredit}</option> : null}
      </SelectField>

      <TextField
        id="recipientEmail"
        name="recipientEmail"
        type="email"
        label={dict.recipientEmail}
        hint={dict.recipientHint}
        error={errors.recipientEmail}
        optionalLabel={dict.optional}
      />

      <TextAreaField
        id="note"
        name="note"
        label={dict.note}
        rows={3}
        optionalLabel={dict.optional}
      />

      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? dict.submitting : dict.submit}
      </Button>
    </form>
  );
}
