import "server-only";

/**
 * Non-order transactional emails (welcome, password reset) sent through Brevo.
 *
 * Each helper sends the email and then best-effort records an email_events row
 * (order_id null) so sends are auditable alongside order emails. None of these
 * throw: email delivery must never block registration or the reset flow.
 */

import { sendEmail } from "@/lib/email/brevo";
import { getSiteSettings } from "@/lib/settings";
import { supabaseService } from "@/lib/supabase/server";
import {
  passwordResetHtml,
  passwordResetSubject,
  welcomeEmailHtml,
  welcomeEmailSubject,
  type EmailContact,
} from "@/lib/email/templates";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

/** Postgres unique_violation — a re-registration hitting the welcome dedupe key. */
const UNIQUE_VIOLATION = "23505";

function contactFrom(settings: { contact: EmailContact }): EmailContact {
  return {
    phone: settings.contact.phone,
    email: settings.contact.email,
    whatsapp: settings.contact.whatsapp,
  };
}

/**
 * Welcome email, sent once per account. Deduped on `welcome:<userId>` so a
 * re-register (or a retry) never sends twice or crashes on the unique index.
 */
export async function sendWelcomeEmail(
  userId: string,
  email: string,
  name: string,
): Promise<{ sent: boolean }> {
  try {
    const settings = await getSiteSettings();
    const subject = welcomeEmailSubject();
    const html = welcomeEmailHtml({
      customerName: name,
      catalogUrl: `${SITE}/catalog`,
      contact: contactFrom(settings),
    });

    const result = await sendEmail({ to: email, toName: name, subject, html });

    const service = supabaseService();
    const { error } = await service.from("email_events").insert({
      order_id: null,
      kind: "welcome",
      recipient: email,
      subject,
      status: result.sent ? "sent" : "failed",
      error: result.error ?? null,
      provider_message_id: result.providerMessageId ?? null,
      attempts: 1,
      dedupe_key: `welcome:${userId}`,
    });
    // Duplicate key = welcome already recorded/sent; not an error worth surfacing.
    if (error && error.code !== UNIQUE_VIOLATION) {
      console.error("welcome email_events insert failed:", error.message);
    }

    return { sent: result.sent };
  } catch (e) {
    console.error("sendWelcomeEmail failed:", e instanceof Error ? e.message : String(e));
    return { sent: false };
  }
}

/**
 * Password reset email. The reset URL is a Supabase-generated action link;
 * routed through Brevo because Supabase's built-in SMTP is too rate-limited.
 * Not deduped — every reset request is a distinct notification.
 */
export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
  name?: string,
): Promise<{ sent: boolean }> {
  try {
    const settings = await getSiteSettings();
    const subject = passwordResetSubject();
    const html = passwordResetHtml({
      customerName: name,
      resetUrl,
      contact: contactFrom(settings),
    });

    const result = await sendEmail({ to: email, toName: name, subject, html });

    const service = supabaseService();
    const { error } = await service.from("email_events").insert({
      order_id: null,
      kind: "password_reset",
      recipient: email,
      subject,
      status: result.sent ? "sent" : "failed",
      error: result.error ?? null,
      provider_message_id: result.providerMessageId ?? null,
      attempts: 1,
      dedupe_key: null,
    });
    if (error) console.error("password_reset email_events insert failed:", error.message);

    return { sent: result.sent };
  } catch (e) {
    console.error(
      "sendPasswordResetEmail failed:",
      e instanceof Error ? e.message : String(e),
    );
    return { sent: false };
  }
}
