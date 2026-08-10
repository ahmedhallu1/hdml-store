"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/server";
import { getAccount } from "@/lib/auth";
import { bucketKey, clientIpFrom, rateLimit } from "@/lib/rate-limit";
import { emailSchema, translateIssues } from "@/lib/validation";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { FormState } from "@/components/marketing/form";

/**
 * Public inquiry actions (quotation requests, contact, supplier applications).
 *
 * All three are unauthenticated, so each validates with zod, rate-limits by IP
 * and by submitted email, and stores structured rows rather than free-form
 * blobs. Nothing here is trusted to say who the sender is.
 */

async function copy(lang: Locale) {
  const dict = await getDictionary(lang);
  return {
    dict,
    validation: dict.validation as unknown as Record<string, string>,
    fallback: dict.errors.validation,
  };
}

async function limited(scope: string, email: string): Promise<boolean> {
  const ip = clientIpFrom(await headers());
  const byIp = await rateLimit(bucketKey(scope, ip), 8, 3600);
  if (!byIp) return false;
  return rateLimit(bucketKey(`${scope}:email`, email), 4, 3600);
}

/** Human-friendly reference: PREFIX-YYYYMMDD-XXXX. */
function reference(prefix: string): string {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" })
    .format(new Date())
    .replace(/-/g, "");
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => alphabet[b % alphabet.length])
    .join("");
  return `${prefix}-${date}-${rand}`;
}

/* ── Quotation request ────────────────────────────────────────────────── */

const rfqSchema = z.object({
  contactName: z.string().trim().min(2).max(120),
  contactEmail: emailSchema,
  contactPhone: z.string().trim().max(40),
  companyName: z.string().trim().max(160),
  destinationCountry: z.string().trim().max(80),
  incoterm: z.string().trim().max(12),
  targetPrice: z.string().trim().max(32),
  productDescription: z.string().trim().min(5).max(2000),
  qty: z.coerce.number().int().min(1).max(100_000_000),
});

export async function submitRfqAction(
  lang: Locale,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { dict, validation, fallback } = await copy(lang);

  const parsed = rfqSchema.safeParse({
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone") ?? "",
    companyName: formData.get("companyName") ?? "",
    destinationCountry: formData.get("destinationCountry") ?? "",
    incoterm: formData.get("incoterm") ?? "",
    targetPrice: formData.get("targetPrice") ?? "",
    productDescription: formData.get("productDescription"),
    qty: formData.get("qty"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: translateIssues(parsed.error, validation, fallback) };
  }

  if (!(await limited("rfq", parsed.data.contactEmail))) {
    return { ok: false, message: dict.errors.rateLimited };
  }

  // A free buyer's monthly RFQ allowance applies only to signed-in accounts;
  // anonymous requests are covered by the rate limiter above.
  const account = await getAccount();

  const service = supabaseService();
  const ref = reference("RFQ");

  let targetPriceValue: string | null = null;
  if (parsed.data.targetPrice) {
    const numeric = Number(parsed.data.targetPrice.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(numeric) && numeric > 0) targetPriceValue = numeric.toFixed(2);
  }

  const { data: rfq, error } = await service
    .from("rfqs")
    .insert({
      reference: ref,
      account_id: account?.user_id ?? null,
      contact_name: parsed.data.contactName,
      contact_email: parsed.data.contactEmail,
      contact_phone: parsed.data.contactPhone || null,
      company_name: parsed.data.companyName || null,
      destination_country: parsed.data.destinationCountry || null,
      incoterm: parsed.data.incoterm || null,
      target_price: targetPriceValue,
      message: parsed.data.productDescription,
    })
    .select("id")
    .single();
  if (error || !rfq) return { ok: false, message: dict.errors.generic };

  await service.from("rfq_items").insert({
    rfq_id: rfq.id,
    description: parsed.data.productDescription,
    qty: parsed.data.qty,
  });

  return {
    ok: true,
    reference: ref,
    message: dict.rfq.successBody.replace("{reference}", ref),
  };
}

/* ── Contact message ──────────────────────────────────────────────────── */

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  subject: z.string().trim().min(2).max(160),
  message: z.string().trim().min(10).max(4000),
});

export async function submitContactAction(
  lang: Locale,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { dict, validation, fallback } = await copy(lang);

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: translateIssues(parsed.error, validation, fallback) };
  }

  if (!(await limited("contact", parsed.data.email))) {
    return { ok: false, message: dict.errors.rateLimited };
  }

  const service = supabaseService();
  await service.from("audit_logs").insert({
    actor: "system",
    action: "contact.message",
    entity: "contact",
    meta: {
      name: parsed.data.name,
      email: parsed.data.email,
      subject: parsed.data.subject,
      message: parsed.data.message,
    },
  });

  return { ok: true, message: dict.contact.successBody };
}

/* ── Supplier application ─────────────────────────────────────────────── */

const supplierSchema = z.object({
  companyName: z.string().trim().min(2).max(200),
  contactName: z.string().trim().min(2).max(120),
  email: emailSchema,
  country: z.string().trim().min(2).max(80),
  productCategories: z.string().trim().min(2).max(400),
  website: z.string().trim().max(200),
  message: z.string().trim().max(2000),
});

export async function submitSupplierAction(
  lang: Locale,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { dict, validation, fallback } = await copy(lang);

  const parsed = supplierSchema.safeParse({
    companyName: formData.get("companyName"),
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    country: formData.get("country"),
    productCategories: formData.get("productCategories"),
    website: formData.get("website") ?? "",
    message: formData.get("message") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: translateIssues(parsed.error, validation, fallback) };
  }

  if (!(await limited("supplier", parsed.data.email))) {
    return { ok: false, message: dict.errors.rateLimited };
  }

  const ref = reference("SUP");
  const service = supabaseService();
  await service.from("audit_logs").insert({
    actor: "system",
    action: "supplier.application",
    entity: "supplier_application",
    entity_id: ref,
    meta: { ...parsed.data },
  });

  return {
    ok: true,
    reference: ref,
    message: dict.suppliersApply.successBody.replace("{reference}", ref),
  };
}
