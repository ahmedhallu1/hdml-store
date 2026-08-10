import "server-only";
import { supabaseService } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/config";
import { sendEmail } from "./send";
import { claimConfirmedEmail, claimLinkEmail, welcomeEmail } from "./templates";

/**
 * High-level notifications. Every send is deduped through eig.email_events
 * (unique dedupe_key), so a retried action never double-emails, and each send
 * is recorded with its outcome. None of these ever throw — a mail failure is
 * logged and swallowed so it can't break signup or order creation.
 */

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://elect-i-global.com";
}

async function sendOnce(args: {
  dedupeKey: string;
  orderId: string | null;
  kind: string;
  to: string;
  toName?: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean }> {
  const service = supabaseService();

  const { data: existing } = await service
    .from("email_events")
    .select("status")
    .eq("dedupe_key", args.dedupeKey)
    .maybeSingle();
  if (existing?.status === "sent") return { sent: true };

  const result = await sendEmail({
    to: args.to,
    toName: args.toName,
    subject: args.subject,
    html: args.html,
  });

  await service.from("email_events").upsert(
    {
      order_id: args.orderId,
      kind: args.kind,
      recipient: args.to,
      dedupe_key: args.dedupeKey,
      status: result.sent ? "sent" : "failed",
      error: result.error ?? null,
    },
    { onConflict: "dedupe_key" },
  );

  if (!result.sent) console.error(`email ${args.kind} to ${args.to} failed: ${result.error}`);
  return { sent: result.sent };
}

/** Welcome email on account creation. Keyed on the user id, so once per account. */
export async function sendWelcomeEmail(userId: string, email: string, name: string, lang: Locale) {
  const { subject, html } = welcomeEmail(name, lang, `${siteUrl()}/${lang}/catalog`);
  return sendOnce({
    dedupeKey: `welcome:${userId}`,
    orderId: null,
    kind: "welcome",
    to: email,
    toName: name,
    subject,
    html,
  });
}

/** Emails the buyer their prepaid claim link. Keyed on the order id. */
export async function sendClaimLinkEmail(args: {
  orderId: string;
  to: string;
  lang: Locale;
  claimUrl: string;
  orderNumber: string;
  externalRef: string;
  merchantName: string | null;
}) {
  const { subject, html } = claimLinkEmail({
    lang: args.lang,
    claimUrl: args.claimUrl,
    orderNumber: args.orderNumber,
    externalRef: args.externalRef,
    merchantName: args.merchantName,
  });
  return sendOnce({
    dedupeKey: `claim_link:${args.orderId}`,
    orderId: args.orderId,
    kind: "claim_link",
    to: args.to,
    subject,
    html,
  });
}

/**
 * Confirms a completed claim to the buyer: what happens next, who delivers,
 * and what the price does not cover. Keyed on the order id, so a resubmitted
 * form or a retried action still sends exactly one.
 */
export async function sendClaimConfirmationEmail(args: {
  orderId: string;
  to: string;
  toName: string;
  lang: Locale;
  orderNumber: string;
  externalRef: string;
  destination: string;
}) {
  const { subject, html } = claimConfirmedEmail({
    lang: args.lang,
    orderNumber: args.orderNumber,
    externalRef: args.externalRef,
    recipientName: args.toName,
    destination: args.destination,
  });
  return sendOnce({
    dedupeKey: `claim_confirmed:${args.orderId}`,
    orderId: args.orderId,
    kind: "claim_confirmed",
    to: args.to,
    toName: args.toName,
    subject,
    html,
  });
}
