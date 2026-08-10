"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/server";
import { auditLog, requireTier } from "@/lib/auth";
import { createOnBehalfOrder } from "@/lib/orders";
import { createTopUpIntent } from "@/lib/payments";
import { encryptSecret, generateApiCredentials, sha256Hex } from "@/lib/crypto";
import {
  apiKeySchema,
  brandingSchema,
  idSchema,
  topUpAmountSchema,
  translateIssues,
  webhookSchema,
  type FieldErrors,
} from "@/lib/validation";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

/**
 * Merchant dashboard actions.
 *
 * Every action re-resolves the caller with `requireTier` — the account id,
 * the tier and every money amount are derived server-side. Nothing in a form
 * payload is trusted to say who the caller is or what they may do.
 */

export interface DashboardState {
  errors?: FieldErrors;
  ok?: boolean;
  /** One-time secret, returned only at creation. */
  secret?: string;
  keyId?: string;
  claimUrl?: string;
  orderNumber?: string;
  redirectUrl?: string;
  /** Wallet top-up settled inline against the saved card. */
  settled?: boolean;
  last4?: string;
}

async function copy(lang: Locale) {
  const dict = await getDictionary(lang);
  return {
    dict,
    validation: dict.validation as unknown as Record<string, string>,
    fallback: dict.errors.validation,
  };
}

/* ── Prepaid orders on behalf of a customer ───────────────────────────── */

const lineSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  qty: z.coerce.number().int().min(1).max(1_000_000),
});

const onBehalfSchema = z.object({
  externalRef: z.string().trim().min(3).max(64),
  payFrom: z.enum(["wallet", "credit"]),
  recipientEmail: z.union([z.email().max(200), z.literal("")]),
  note: z.string().trim().max(1000),
  lines: z.array(lineSchema).min(1).max(100),
});

export async function createOnBehalfAction(
  lang: Locale,
  _prev: DashboardState,
  formData: FormData,
): Promise<DashboardState> {
  const { account } = await requireTier(lang, "merchant");
  const { dict, validation, fallback } = await copy(lang);

  // Line rows arrive as parallel `sku[]` / `qty[]` fields.
  const skus = formData.getAll("sku").map(String);
  const qtys = formData.getAll("qty").map(String);
  const lines = skus
    .map((sku, i) => ({ sku: sku.trim(), qty: qtys[i] ?? "0" }))
    .filter((l) => l.sku.length > 0);

  const parsed = onBehalfSchema.safeParse({
    externalRef: formData.get("externalRef"),
    payFrom: formData.get("payFrom"),
    recipientEmail: formData.get("recipientEmail") ?? "",
    note: formData.get("note") ?? "",
    lines,
  });
  if (!parsed.success) {
    return { errors: translateIssues(parsed.error, validation, fallback) };
  }

  try {
    const created = await createOnBehalfOrder({
      merchantAccountId: account.user_id,
      merchantTier: account.tier,
      items: parsed.data.lines.map((l) => ({ sku: l.sku, qty: l.qty })),
      externalRef: parsed.data.externalRef,
      externalSource: "dashboard",
      payFrom: parsed.data.payFrom,
      // One order per submitted reference per merchant: a double-submit
      // returns the original rather than charging the wallet twice.
      idempotencyKey: `dash:${account.user_id}:${parsed.data.externalRef}`,
      recipientEmail: parsed.data.recipientEmail || null,
      recipientLocale: lang,
      buyerNote: parsed.data.note || null,
    });

    revalidatePath(`/${lang}/dashboard/on-behalf`);
    return {
      ok: true,
      claimUrl: created.claimUrl,
      orderNumber: created.orderNumber,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return { errors: { _form: message || dict.errors.generic } };
  }
}

/* ── Wallet ───────────────────────────────────────────────────────────── */

export async function startTopUpAction(
  lang: Locale,
  _prev: DashboardState,
  formData: FormData,
): Promise<DashboardState> {
  const { account } = await requireTier(lang, "merchant");
  const { dict, validation, fallback } = await copy(lang);

  const parsed = topUpAmountSchema.safeParse(formData.get("amount"));
  if (!parsed.success) {
    return { errors: translateIssues(parsed.error, validation, fallback) };
  }

  try {
    // createTopUpIntent re-checks the bounds server-side; this is not the
    // only guard on the amount.
    const intent = await createTopUpIntent(account.user_id, parsed.data);
    await auditLog("merchant", account.user_id, "wallet.topup_started", "payment", intent.paymentId, {
      amount_cents: intent.amountCents,
    });

    // A live gateway (Paymob) hands back a redirect URL to complete the card
    // payment. Otherwise the charge settles inline against the saved card and
    // the wallet is credited immediately.
    if (intent.redirectUrl) {
      return { ok: true, redirectUrl: intent.redirectUrl };
    }

    const { settlePayment } = await import("@/lib/payments");
    const { getDefaultCard } = await import("@/lib/billing");
    const card = await getDefaultCard(account.user_id);
    await settlePayment(intent.paymentId, "paid", card ? `visa_${card.last4}` : undefined, {
      brand: card?.brand ?? "visa",
      last4: card?.last4 ?? "4261",
    });
    await auditLog("merchant", account.user_id, "wallet.topup_settled", "payment", intent.paymentId, {
      amount_cents: intent.amountCents,
    });

    revalidatePath(`/${lang}/dashboard/wallet`);
    revalidatePath(`/${lang}/dashboard/billing`);
    revalidatePath(`/${lang}/dashboard`);
    return { ok: true, settled: true, last4: card?.last4 ?? "4261" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return { errors: { _form: message || dict.errors.generic } };
  }
}

/* ── API keys ─────────────────────────────────────────────────────────── */

export async function createApiKeyAction(
  lang: Locale,
  _prev: DashboardState,
  formData: FormData,
): Promise<DashboardState> {
  const { account, privileges } = await requireTier(lang, "merchant");
  const { dict, validation, fallback } = await copy(lang);

  if (privileges.apiAccess === "none") {
    return { errors: { _form: dict.errors.forbidden } };
  }

  const parsed = apiKeySchema.safeParse({
    name: formData.get("name"),
    scopes: formData.getAll("scopes").map(String),
  });
  if (!parsed.success) {
    return { errors: translateIssues(parsed.error, validation, fallback) };
  }

  // A read-only tier cannot mint write scopes, whatever the checkboxes said.
  const scopes =
    privileges.apiAccess === "full"
      ? parsed.data.scopes
      : parsed.data.scopes.filter((s) => s.endsWith(":read"));
  if (scopes.length === 0) return { errors: { scopes: dict.errors.forbidden } };

  const { keyId, secret } = generateApiCredentials();
  const service = supabaseService();
  const { error } = await service.from("api_keys").insert({
    account_id: account.user_id,
    key_id: keyId,
    secret_hash: await sha256Hex(secret),
    secret_encrypted: await encryptSecret(secret),
    secret_preview: secret.slice(-4),
    name: parsed.data.name,
    scopes,
  });
  if (error) return { errors: { _form: dict.errors.generic } };

  await auditLog("merchant", account.user_id, "api_key.created", "api_key", keyId, { scopes });
  revalidatePath(`/${lang}/dashboard/api`);

  // The only time the plaintext secret ever leaves the server.
  return { ok: true, keyId, secret };
}

export async function revokeApiKeyAction(lang: Locale, formData: FormData): Promise<void> {
  const { account } = await requireTier(lang, "merchant");
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) return;

  const service = supabaseService();
  // Scoped to the caller's own account so an id from another merchant is inert.
  await service
    .from("api_keys")
    .update({ active: false, revoked_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .eq("account_id", account.user_id);

  await auditLog("merchant", account.user_id, "api_key.revoked", "api_key", parsed.data);
  revalidatePath(`/${lang}/dashboard/api`);
}

/* ── Webhooks ─────────────────────────────────────────────────────────── */

export async function createWebhookAction(
  lang: Locale,
  _prev: DashboardState,
  formData: FormData,
): Promise<DashboardState> {
  const { account, privileges } = await requireTier(lang, "merchant");
  const { dict, validation, fallback } = await copy(lang);

  if (!privileges.webhooks) return { errors: { _form: dict.errors.forbidden } };

  const parsed = webhookSchema.safeParse({
    url: formData.get("url"),
    events: formData.getAll("events").map(String),
  });
  if (!parsed.success) {
    return { errors: translateIssues(parsed.error, validation, fallback) };
  }

  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const secret = `whsec_${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;

  const service = supabaseService();
  const { error } = await service.from("webhook_endpoints").insert({
    account_id: account.user_id,
    url: parsed.data.url,
    secret,
    events: parsed.data.events,
  });
  if (error) return { errors: { _form: dict.errors.generic } };

  await auditLog("merchant", account.user_id, "webhook.created", "webhook", parsed.data.url);
  revalidatePath(`/${lang}/dashboard/api`);
  return { ok: true, secret };
}

export async function deleteWebhookAction(lang: Locale, formData: FormData): Promise<void> {
  const { account } = await requireTier(lang, "merchant");
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) return;

  const service = supabaseService();
  await service
    .from("webhook_endpoints")
    .delete()
    .eq("id", parsed.data)
    .eq("account_id", account.user_id);

  await auditLog("merchant", account.user_id, "webhook.deleted", "webhook", parsed.data);
  revalidatePath(`/${lang}/dashboard/api`);
}

/* ── Claim-page branding ──────────────────────────────────────────────── */

export async function updateBrandingAction(
  lang: Locale,
  _prev: DashboardState,
  formData: FormData,
): Promise<DashboardState> {
  const { account, privileges } = await requireTier(lang, "merchant");
  const { dict, validation, fallback } = await copy(lang);

  if (!privileges.coBrandedClaimPage) return { errors: { _form: dict.errors.forbidden } };

  const parsed = brandingSchema.safeParse({
    displayName: formData.get("displayName") ?? "",
    logoUrl: formData.get("logoUrl") ?? "",
  });
  if (!parsed.success) {
    return { errors: translateIssues(parsed.error, validation, fallback) };
  }

  const service = supabaseService();
  const { error } = await service
    .from("accounts")
    .update({
      brand_display_name: parsed.data.displayName,
      brand_logo_url: parsed.data.logoUrl,
    })
    .eq("user_id", account.user_id);
  if (error) return { errors: { _form: dict.errors.generic } };

  await auditLog("merchant", account.user_id, "branding.updated", "account", account.user_id);
  revalidatePath(`/${lang}/dashboard/settings`);
  return { ok: true };
}

/* ── Billing: saved cards ─────────────────────────────────────────────── */

const cardSchema = z.object({
  number: z
    .string()
    .transform((v) => v.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^\d{13,19}$/, { error: "invalidCard" })),
  holder: z.string().trim().min(2).max(80),
  exp: z
    .string()
    .trim()
    .regex(/^(0[1-9]|1[0-2])\s*\/\s*\d{2}$/, { error: "invalidExpiry" }),
});

export async function addCardAction(
  lang: Locale,
  _prev: DashboardState,
  formData: FormData,
): Promise<DashboardState> {
  const { account } = await requireTier(lang, "merchant");
  const { dict } = await copy(lang);

  const parsed = cardSchema.safeParse({
    number: formData.get("number"),
    holder: formData.get("holder"),
    exp: formData.get("exp"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { errors: { [String(first.path[0] ?? "_form")]: dict.errors.validation } };
  }

  const [mm, yy] = parsed.data.exp.split("/").map((s) => s.trim());
  const { addCard } = await import("@/lib/billing");
  await addCard(account.user_id, {
    number: parsed.data.number,
    exp_month: Number(mm),
    exp_year: 2000 + Number(yy),
    holder: parsed.data.holder,
  });
  await auditLog("merchant", account.user_id, "billing.card_added", "account", account.user_id);
  revalidatePath(`/${lang}/dashboard/billing`);
  return { ok: true };
}

/** Holder and expiry only — see `updateCard` for why the number is fixed. */
export async function updateCardAction(
  lang: Locale,
  _prev: DashboardState,
  formData: FormData,
): Promise<DashboardState> {
  const { account } = await requireTier(lang, "merchant");
  const { dict } = await copy(lang);

  const id = String(formData.get("id") ?? "");
  if (!id) return { errors: { _form: dict.errors.validation } };

  const parsed = cardSchema.omit({ number: true }).safeParse({
    holder: formData.get("holder"),
    exp: formData.get("exp"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { errors: { [String(first.path[0] ?? "_form")]: dict.errors.validation } };
  }

  const [mm, yy] = parsed.data.exp.split("/").map((s) => s.trim());
  const { updateCard } = await import("@/lib/billing");
  await updateCard(account.user_id, id, {
    exp_month: Number(mm),
    exp_year: 2000 + Number(yy),
    holder: parsed.data.holder,
  });
  await auditLog("merchant", account.user_id, "billing.card_updated", "account", account.user_id);
  revalidatePath(`/${lang}/dashboard/billing`);
  return { ok: true };
}

export async function setDefaultCardAction(lang: Locale, formData: FormData): Promise<void> {
  const { account } = await requireTier(lang, "merchant");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { setDefaultCard } = await import("@/lib/billing");
  await setDefaultCard(account.user_id, id);
  revalidatePath(`/${lang}/dashboard/billing`);
}

export async function removeCardAction(lang: Locale, formData: FormData): Promise<void> {
  const { account } = await requireTier(lang, "merchant");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { removeCard } = await import("@/lib/billing");
  await removeCard(account.user_id, id);
  revalidatePath(`/${lang}/dashboard/billing`);
}
