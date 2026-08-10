"use client";

import { useActionState, useState } from "react";
import {
  createApiKeyAction,
  createWebhookAction,
  deleteWebhookAction,
  revokeApiKeyAction,
  type DashboardState,
} from "@/server/actions/dashboard";
import type { Locale } from "@/i18n/config";
import type { ApiKey, WebhookEndpoint } from "@/lib/db-types";
import { API_SCOPES, READ_ONLY_SCOPES, WEBHOOK_EVENTS } from "@/lib/validation";
import { TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { CopyButton } from "./copy-button";

export interface ApiManagerDict {
  apiKeys: string;
  createKey: string;
  keyName: string;
  keyNameHint: string;
  scopes: string;
  scopeLabels: Record<string, string>;
  keyCreated: string;
  keyId: string;
  keySecret: string;
  keySecretOnce: string;
  keyPreview: string;
  keyLastUsed: string;
  keyNeverUsed: string;
  keyNoExpiry: string;
  keyCreatedOn: string;
  revoke: string;
  revokeConfirm: string;
  noKeys: string;
  webhookEndpoints: string;
  addEndpoint: string;
  webhookUrl: string;
  webhookUrlHint: string;
  webhookEvents: string;
  eventLabels: Record<string, string>;
  webhookSecret: string;
  webhookSecretOnce: string;
  noWebhooks: string;
  copy: string;
  copied: string;
  create: string;
  creating: string;
  delete: string;
  webhooksDisabled: string | null;
}

export function ApiKeyManager({
  lang,
  keys,
  fullAccess,
  localeTag,
  dict,
}: {
  lang: Locale;
  keys: ApiKey[];
  fullAccess: boolean;
  /**
   * BCP-47 tag, not a formatter function — a function prop cannot cross the
   * server/client boundary, so dates are formatted here instead.
   */
  localeTag: string;
  dict: ApiManagerDict;
}) {
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(localeTag, { dateStyle: "medium" }).format(new Date(iso));
  const [state, action, pending] = useActionState<DashboardState, FormData>(
    createApiKeyAction.bind(null, lang),
    {},
  );
  const errors = state.errors ?? {};
  const offerable = fullAccess ? API_SCOPES : READ_ONLY_SCOPES;

  return (
    <section className="panel p-6" aria-labelledby="keys-heading">
      <h2 id="keys-heading" className="font-bold text-ink-50">
        {dict.apiKeys}
      </h2>

      {/* One-time secret reveal. Shown once, never retrievable again. */}
      {state.ok && state.secret ? (
        <div className="mt-4 rounded-xl border border-verify-500/30 bg-verify-500/[0.07] p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-verify-300">
            <Icon name="shield" className="size-4" />
            {dict.keyCreated}
          </p>
          <p className="mt-1 text-xs text-ink-400">{dict.keySecretOnce}</p>
          <dl className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <dt className="w-16 text-xs text-ink-500">{dict.keyId}</dt>
              <dd className="font-mono text-xs text-ink-200">{state.keyId}</dd>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="w-16 text-xs text-ink-500">{dict.keySecret}</dt>
              <dd className="flex min-w-0 flex-1 items-center gap-2">
                <code className="min-w-0 flex-1 break-all font-mono text-xs text-accent-200">
                  {state.secret}
                </code>
                <CopyButton value={state.secret} label={dict.copy} copiedLabel={dict.copied} />
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      <form action={action} className="mt-4 flex flex-col gap-4">
        {errors._form ? (
          <p role="alert" className="rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-sm text-danger-400">
            {errors._form}
          </p>
        ) : null}
        <TextField
          id="keyName"
          name="name"
          label={dict.keyName}
          hint={dict.keyNameHint}
          error={errors.name}
          required
        />
        <fieldset>
          <legend className="text-sm font-semibold text-ink-300">{dict.scopes}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {offerable.map((scope) => (
              <label
                key={scope}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm text-ink-300 transition-colors hover:border-white/20"
              >
                <input
                  type="checkbox"
                  name="scopes"
                  value={scope}
                  defaultChecked={scope.endsWith(":read")}
                  className="size-4 accent-accent-500"
                />
                {dict.scopeLabels[scope] ?? scope}
              </label>
            ))}
          </div>
          {errors.scopes ? (
            <p role="alert" className="mt-1.5 text-xs text-danger-400">
              {errors.scopes}
            </p>
          ) : null}
        </fieldset>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? dict.creating : dict.createKey}
        </Button>
      </form>

      <ul className="mt-6 divide-y divide-white/5">
        {keys.length === 0 ? (
          <li className="py-6 text-center text-sm text-ink-500">{dict.noKeys}</li>
        ) : (
          keys.map((key) => (
            <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-100">{key.name}</p>
                <p className="mt-0.5 font-mono text-xs text-ink-500">
                  {key.key_id}{" "}
                  <span className="text-ink-600">· secret •••{key.secret_preview}</span>
                </p>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-600">
                  <span>
                    {dict.keyCreatedOn}: {fmtDate(key.created_at)}
                  </span>
                  <span>
                    {key.last_used_at
                      ? `${dict.keyLastUsed}: ${fmtDate(key.last_used_at)}`
                      : dict.keyNeverUsed}
                  </span>
                  <span className="text-settled-500">{dict.keyNoExpiry}</span>
                </p>
              </div>
              <RevokeKeyButton lang={lang} id={key.id} label={dict.revoke} confirm={dict.revokeConfirm} />
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function RevokeKeyButton({
  lang,
  id,
  label,
  confirm,
}: {
  lang: Locale;
  id: string;
  label: string;
  confirm: string;
}) {
  return (
    <form
      action={revokeApiKeyAction.bind(null, lang)}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-white/12 px-3 text-xs font-semibold text-ink-400 transition-colors hover:border-danger-500/40 hover:text-danger-400"
      >
        {label}
      </button>
    </form>
  );
}

export function WebhookManager({
  lang,
  endpoints,
  enabled,
  dict,
}: {
  lang: Locale;
  endpoints: WebhookEndpoint[];
  enabled: boolean;
  dict: ApiManagerDict;
}) {
  const [state, action, pending] = useActionState<DashboardState, FormData>(
    createWebhookAction.bind(null, lang),
    {},
  );
  const [selected, setSelected] = useState<string[]>([...WEBHOOK_EVENTS]);
  const errors = state.errors ?? {};

  if (!enabled) {
    return (
      <section className="panel p-6">
        <h2 className="font-bold text-ink-50">{dict.webhookEndpoints}</h2>
        <p className="mt-2 text-sm text-ink-400">{dict.webhooksDisabled}</p>
      </section>
    );
  }

  return (
    <section className="panel p-6" aria-labelledby="webhooks-heading">
      <h2 id="webhooks-heading" className="font-bold text-ink-50">
        {dict.webhookEndpoints}
      </h2>

      {state.ok && state.secret ? (
        <div className="mt-4 rounded-xl border border-verify-500/30 bg-verify-500/[0.07] p-4">
          <p className="text-sm font-semibold text-verify-300">{dict.webhookSecret}</p>
          <p className="mt-1 text-xs text-ink-400">{dict.webhookSecretOnce}</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all font-mono text-xs text-accent-200">
              {state.secret}
            </code>
            <CopyButton value={state.secret} label={dict.copy} copiedLabel={dict.copied} />
          </div>
        </div>
      ) : null}

      <form action={action} className="mt-4 flex flex-col gap-4">
        {errors._form ? (
          <p role="alert" className="rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-sm text-danger-400">
            {errors._form}
          </p>
        ) : null}
        <TextField
          id="webhookUrl"
          name="url"
          type="url"
          label={dict.webhookUrl}
          hint={dict.webhookUrlHint}
          placeholder="https://your-system.example.com/webhooks/eig"
          error={errors.url}
          required
        />
        <fieldset>
          <legend className="text-sm font-semibold text-ink-300">{dict.webhookEvents}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {WEBHOOK_EVENTS.map((event) => (
              <label
                key={event}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm text-ink-300 transition-colors hover:border-white/20"
              >
                <input
                  type="checkbox"
                  name="events"
                  value={event}
                  checked={selected.includes(event)}
                  onChange={(e) =>
                    setSelected((s) =>
                      e.target.checked ? [...s, event] : s.filter((x) => x !== event),
                    )
                  }
                  className="size-4 accent-accent-500"
                />
                {dict.eventLabels[event] ?? event}
              </label>
            ))}
          </div>
          {errors.events ? (
            <p role="alert" className="mt-1.5 text-xs text-danger-400">
              {errors.events}
            </p>
          ) : null}
        </fieldset>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? dict.creating : dict.addEndpoint}
        </Button>
      </form>

      <ul className="mt-6 divide-y divide-white/5">
        {endpoints.length === 0 ? (
          <li className="py-6 text-center text-sm text-ink-500">{dict.noWebhooks}</li>
        ) : (
          endpoints.map((endpoint) => (
            <li
              key={endpoint.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3.5"
            >
              <div className="min-w-0">
                <p className="break-all font-mono text-xs text-ink-200">{endpoint.url}</p>
                <p className="mt-1 flex flex-wrap gap-1">
                  {endpoint.events.map((event) => (
                    <span
                      key={event}
                      className="rounded border border-white/8 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-ink-500"
                    >
                      {event}
                    </span>
                  ))}
                </p>
              </div>
              <form action={deleteWebhookAction.bind(null, lang)}>
                <input type="hidden" name="id" value={endpoint.id} />
                <button
                  type="submit"
                  className="inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-white/12 px-3 text-xs font-semibold text-ink-400 transition-colors hover:border-danger-500/40 hover:text-danger-400"
                >
                  {dict.delete}
                </button>
              </form>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
