import "server-only";

/**
 * Brevo transactional email (REST API, no SDK — free tier), ported from the
 * HDML store.
 *
 * - Mock mode: when EMAIL_MOCK === "1" or BREVO_API_KEY is missing, emails are
 *   logged instead of sent, so the platform runs fine before a key exists.
 * - Never throws: every failure folds into `{ sent: false, error }` so a mail
 *   outage can never break signup or order creation.
 */

export interface SendEmailInput {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface SendEmailResult {
  sent: boolean;
  providerMessageId?: string;
  error?: string;
  mocked?: boolean;
}

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export function emailConfigured(): boolean {
  return process.env.EMAIL_MOCK !== "1" && Boolean(process.env.BREVO_API_KEY);
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY;

  if (process.env.EMAIL_MOCK === "1" || !apiKey) {
    console.log(
      `[email:mock] to=${input.to} subject="${input.subject}" htmlBytes=${input.html.length}`,
    );
    return { sent: true, mocked: true, providerMessageId: `mock-${Date.now()}` };
  }

  const fromEmail = process.env.EMAIL_FROM;
  if (!fromEmail) return { sent: false, error: "EMAIL_FROM is not configured" };

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          email: fromEmail,
          name: process.env.EMAIL_FROM_NAME || "ELECT-I Global",
        },
        to: [{ email: input.to, ...(input.toName ? { name: input.toName } : {}) }],
        ...(input.replyTo ? { replyTo: { email: input.replyTo } } : {}),
        subject: input.subject,
        htmlContent: input.html,
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
