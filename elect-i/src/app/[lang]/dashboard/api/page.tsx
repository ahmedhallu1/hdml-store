import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, LOCALE_TAGS, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { requireTier } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import type { ApiKey, WebhookEndpoint } from "@/lib/db-types";
import { ApiKeyManager, WebhookManager } from "@/components/dashboard/api-manager";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "API & webhooks" };

export default async function DashboardApiPage({ params }: PageProps<"/[lang]/dashboard/api">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const { account, privileges } = await requireTier(lang, "merchant");

  // API access starts at Merchant (read-only). If a tier has none at all,
  // show the upgrade wall instead of the managers.
  if (privileges.apiAccess === "none") {
    return (
      <Reveal>
        <div className="panel p-8 text-center">
          <span className="mx-auto inline-flex size-12 items-center justify-center rounded-xl border border-accent-400/25 bg-accent-500/10 text-accent-300">
            <Icon name="code" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-ink-50">{dict.dashboard.apiUpgradeTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-400">
            {dict.dashboard.apiUpgradeBody}
          </p>
          <ButtonLink href={`/${lang}/membership`} className="mt-5">
            {dict.dashboard.upgradeCta}
          </ButtonLink>
        </div>
      </Reveal>
    );
  }

  const service = supabaseService();
  const [{ data: keys }, { data: endpoints }] = await Promise.all([
    service
      .from("api_keys")
      .select("id, key_id, secret_preview, name, scopes, last_used_at, active, created_at, revoked_at")
      .eq("account_id", account.user_id)
      .eq("active", true)
      .order("created_at", { ascending: false }),
    service
      .from("webhook_endpoints")
      .select("id, url, events, active, created_at")
      .eq("account_id", account.user_id)
      .eq("active", true)
      .order("created_at", { ascending: false }),
  ]);

  const managerDict = {
    apiKeys: dict.dashboard.apiKeys,
    createKey: dict.dashboard.createKey,
    keyName: dict.dashboard.keyName,
    keyNameHint: dict.dashboard.keyNameHint,
    scopes: dict.dashboard.scopes,
    scopeLabels: {
      "orders:read": dict.dashboard.scopeOrdersRead,
      "orders:write": dict.dashboard.scopeOrdersWrite,
      "wallet:read": dict.dashboard.scopeWalletRead,
      "quotes:write": dict.dashboard.scopeQuotesWrite,
      "catalog:read": dict.dashboard.scopeCatalogRead,
    },
    keyCreated: dict.dashboard.keyCreated,
    keyId: dict.dashboard.keyId,
    keySecret: dict.dashboard.keySecret,
    keySecretOnce: dict.dashboard.keySecretOnce,
    keyPreview: dict.dashboard.keyPreview,
    keyLastUsed: dict.dashboard.keyLastUsed,
    keyNeverUsed: dict.dashboard.keyNeverUsed,
    keyNoExpiry: dict.dashboard.keyNoExpiry,
    keyCreatedOn: dict.dashboard.keyCreatedOn,
    revoke: dict.dashboard.revoke,
    revokeConfirm: dict.dashboard.revokeConfirm,
    noKeys: dict.dashboard.noKeys,
    webhookEndpoints: dict.dashboard.webhookEndpoints,
    addEndpoint: dict.dashboard.addEndpoint,
    webhookUrl: dict.dashboard.webhookUrl,
    webhookUrlHint: dict.dashboard.webhookUrlHint,
    webhookEvents: dict.dashboard.webhookEvents,
    eventLabels: {
      "order.created": dict.dashboard.eventOrderCreated,
      "order.claimed": dict.dashboard.eventOrderClaimed,
      "order.shipped": dict.dashboard.eventOrderShipped,
      "order.delivered": dict.dashboard.eventOrderDelivered,
      "order.cancelled": dict.dashboard.eventOrderCancelled,
      "wallet.low_balance": dict.dashboard.eventWalletLowBalance,
    },
    webhookSecret: dict.dashboard.webhookSecret,
    webhookSecretOnce: dict.dashboard.webhookSecretOnce,
    noWebhooks: dict.dashboard.noWebhooks,
    copy: dict.common.copy,
    copied: dict.common.copied,
    create: dict.common.create,
    creating: dict.common.saving,
    delete: dict.common.delete,
    webhooksDisabled: dict.dashboard.webhooksUpgradeBody,
  };

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <p className="text-sm text-ink-400">{dict.dashboard.apiLead}</p>
      </Reveal>
      <Reveal delay={60}>
        <ApiKeyManager
          lang={lang}
          keys={(keys as ApiKey[]) ?? []}
          fullAccess={privileges.apiAccess === "full"}
          localeTag={LOCALE_TAGS[lang as Locale]}
          dict={managerDict}
        />
      </Reveal>
      <Reveal delay={110}>
        <WebhookManager
          lang={lang}
          endpoints={(endpoints as WebhookEndpoint[]) ?? []}
          enabled={privileges.webhooks}
          dict={managerDict}
        />
      </Reveal>
    </div>
  );
}
