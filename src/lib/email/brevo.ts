/**
 * Brevo transactional email client (REST API, no SDK — free tier).
 *
 * - Mock mode: when EMAIL_MOCK === "1" or BREVO_API_KEY is missing, emails
 *   are logged instead of sent so local dev / preview never needs a key.
 * - Never throws: every failure is folded into `{ sent: false, error }` so
 *   callers (checkout, admin approval) can degrade gracefully.
 */

import "server-only";

export interface SendEmailInput {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  /** contentBase64 = raw base64 (no data: prefix), as Brevo expects. */
  attachments?: Array<{ name: string; contentBase64: string }>;
}

export interface SendEmailResult {
  sent: boolean;
  providerMessageId?: string;
  error?: string;
  mocked?: boolean;
}

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY;

  // Mock mode — log a summary and pretend success.
  if (process.env.EMAIL_MOCK === "1" || !apiKey) {
    console.log(
      `[email:mock] to=${input.to} subject="${input.subject}" ` +
        `attachments=${input.attachments?.length ?? 0} htmlBytes=${input.html.length}`,
    );
    return { sent: true, mocked: true, providerMessageId: `mock-${Date.now()}` };
  }

  const fromEmail = process.env.EMAIL_FROM;
  if (!fromEmail) {
    return { sent: false, error: "EMAIL_FROM is not configured" };
  }

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: fromEmail, name: process.env.EMAIL_FROM_NAME || "HDML Store" },
        to: [{ email: input.to, ...(input.toName ? { name: input.toName } : {}) }],
        subject: input.subject,
        htmlContent: input.html,
        ...(input.attachments?.length
          ? {
              attachment: input.attachments.map((a) => ({
                name: a.name,
                content: a.contentBase64,
              })),
            }
          : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { sent: false, error: `Brevo ${res.status}: ${body.slice(0, 500)}` };
    }

    const json = (await res.json().catch(() => ({}))) as { messageId?: string };
    return { sent: true, providerMessageId: json.messageId };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}
