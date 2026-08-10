/**
 * Shared zod schemas for everything the server accepts.
 *
 * Two rules this file exists to enforce:
 *
 *  1. Every server action validates its input here before touching the
 *     database. Server Actions are public POST endpoints — the rendered form
 *     is not a boundary.
 *  2. Error messages are stable *keys*, not sentences. Actions run on the
 *     server and know the locale, so they translate the key through
 *     `dict.validation` at the very end (see `messageFor`). That keeps zod
 *     free of English copy and keeps both locales in sync.
 */

import { z } from "zod";
import { LOCALES } from "@/i18n/config";
import { TIERS } from "@/lib/tiers";
import { toCents } from "@/lib/money";
import {
  CONVERTIBLE_CURRENCY_CODES,
  CURRENCY_CODES,
  MAX_RATE,
  type ConvertibleCurrencyCode,
} from "@/lib/currency";

/* ── Money limits ──────────────────────────────────────────────────────── */

/**
 * Wallet top-up bounds, in integer USD cents.
 *
 * These MIRROR the authoritative constants in `@/lib/payments`, which re-checks
 * them before it creates an intent. They are duplicated here rather than
 * re-exported because that module is `server-only` and these values are needed
 * to render the form's helper text on the client.
 */
export const MIN_TOPUP_CENTS = 1_000; // $10.00
export const MAX_TOPUP_CENTS = 5_000_000; // $50,000.00

/* ── Primitives ────────────────────────────────────────────────────────── */

const trimmed = z.string().trim();

export const emailSchema = trimmed
  .min(1, { error: "required" })
  .max(254, { error: "tooLong" })
  .toLowerCase()
  .pipe(z.email({ error: "invalidEmail" }));

/**
 * 72 bytes is bcrypt's hard limit and what Supabase enforces; rejecting here
 * gives a field-level message instead of an opaque provider error.
 */
export const passwordSchema = z
  .string()
  .min(8, { error: "passwordTooShort" })
  .max(72, { error: "passwordTooLong" });

export const fullNameSchema = trimmed
  .min(2, { error: "nameTooShort" })
  .max(120, { error: "tooLong" });

/** Optional free text: an empty field is stored as SQL NULL, never as "". */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, { error: "tooLong" })
    .transform((v) => (v.length === 0 ? null : v));
}

export const companyNameSchema = optionalText(160);
export const countrySchema = optionalText(80);
export const vatNumberSchema = optionalText(64);

/**
 * Deliberately permissive: E.164 plus the separators people actually type.
 * Rejecting valid international formats is worse than storing a stray space.
 */
export const phoneSchema = z
  .string()
  .trim()
  .max(32, { error: "tooLong" })
  .refine((v) => v.length === 0 || /^\+?[\d\s()./-]{6,32}$/.test(v), { error: "invalidPhone" })
  .transform((v) => (v.length === 0 ? null : v));

export const localeSchema = z.enum(LOCALES, { error: "invalidSelection" });
export const tierSchema = z.enum(TIERS, { error: "invalidSelection" });

/* ── Redirects ─────────────────────────────────────────────────────────── */

/**
 * `?next=` is attacker-controlled. Only same-origin absolute *paths* survive:
 * anything starting `//`, `/\` or carrying a scheme becomes null and the
 * caller falls back to its own default. This is the open-redirect guard.
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (raw.length === 0 || raw.length > 512) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  // Control characters can smuggle a header/JS break past a naive check.
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  return raw;
}

/* ── Auth forms ────────────────────────────────────────────────────────── */

export const signInSchema = z.object({
  email: emailSchema,
  // Length rules are not applied on sign-in: an existing password that
  // predates a rule change must still be usable, and a field-level "too
  // short" message on a login form leaks the shape of stored passwords.
  password: z.string().min(1, { error: "required" }).max(200, { error: "tooLong" }),
});

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    fullName: fullNameSchema,
    companyName: companyNameSchema,
  })
  .refine((v) => v.password === v.confirmPassword, {
    error: "passwordMismatch",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    error: "passwordMismatch",
    path: ["confirmPassword"],
  });

/* ── Profile ───────────────────────────────────────────────────────────── */

export const profileSchema = z.object({
  fullName: fullNameSchema,
  companyName: companyNameSchema,
  companyCountry: countrySchema,
  phone: phoneSchema,
  vatNumber: vatNumberSchema,
});

/* ── Money ─────────────────────────────────────────────────────────────── */

/**
 * A user-typed USD amount ("1,250" / "1250.00") into integer cents. Never
 * trust the client for the *charge* amount either — the action re-checks the
 * bounds after this schema runs.
 */
export const topUpAmountSchema = z
  .string()
  .trim()
  .min(1, { error: "required" })
  .transform((value, ctx) => {
    try {
      return toCents(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "invalidAmount" });
      return z.NEVER;
    }
  })
  .refine((cents) => cents >= MIN_TOPUP_CENTS, { error: "amountTooSmall" })
  .refine((cents) => cents <= MAX_TOPUP_CENTS, { error: "amountTooLarge" });

/* ── Display currency (admin) ──────────────────────────────────────────── */

/**
 * An FX rate typed by an admin: units of the target currency per 1 USD.
 *
 * Kept as a string until the very end so "3,75" or "1e9" never sneak past as
 * a Number. Six decimals is more precision than any retail rate needs and
 * still exact in a double.
 */
export const fxRateSchema = z
  .string()
  .trim()
  .min(1, { error: "required" })
  .transform((v) => v.replace(/,/g, ""))
  .refine((v) => /^\d+(\.\d{1,6})?$/.test(v), { error: "invalidRate" })
  .transform((v) => Number(v))
  .refine((n) => Number.isFinite(n) && n > 0, { error: "invalidRate" })
  .refine((n) => n <= MAX_RATE, { error: "rateTooLarge" });

/**
 * The whole display-currency table.
 *
 * Rates arrive as raw strings and are keyed by code, so an issue path of
 * `rates.EGP` maps straight back to the input that produced it. A blank rate
 * is "not configured yet", not an error — it only becomes one if the admin
 * also ticked that currency on, because then there is no honest number to
 * show a visitor.
 *
 * Note what is NOT here: the transacted currency. This form can only change
 * what a browsing visitor is shown.
 */
export const displayCurrencySchema = z
  .object({
    defaultCurrency: z.enum(CURRENCY_CODES, { error: "invalidSelection" }),
    rates: z.record(z.enum(CONVERTIBLE_CURRENCY_CODES), z.string().trim()),
    enabled: z.array(z.enum(CONVERTIBLE_CURRENCY_CODES, { error: "invalidSelection" })),
  })
  .superRefine((value, ctx) => {
    for (const code of CONVERTIBLE_CURRENCY_CODES) {
      const raw = value.rates[code] ?? "";
      if (raw.length === 0) {
        if (value.enabled.includes(code)) {
          ctx.addIssue({ code: "custom", message: "required", path: ["rates", code] });
        }
        continue;
      }
      const rate = fxRateSchema.safeParse(raw);
      if (!rate.success) {
        ctx.addIssue({
          code: "custom",
          message: rate.error.issues[0]?.message ?? "invalidRate",
          path: ["rates", code],
        });
      }
    }
  })
  .transform((value) => ({
    defaultCurrency: value.defaultCurrency,
    enabled: value.enabled,
    // Re-parsed rather than re-implemented, so there is exactly one definition
    // of what a valid rate string means. A blank or rejected rate is 0, which
    // `normaliseRates` reads as "switched off".
    rates: Object.fromEntries(
      CONVERTIBLE_CURRENCY_CODES.map((code) => {
        const rate = fxRateSchema.safeParse(value.rates[code] ?? "");
        return [code, rate.success ? rate.data : 0];
      }),
    ) as Record<ConvertibleCurrencyCode, number>,
  }));

/* ── Merchant API ──────────────────────────────────────────────────────── */

export const API_SCOPES = [
  "orders:read",
  "orders:write",
  "wallet:read",
  "quotes:write",
  "catalog:read",
] as const;

/** Scopes a read-only tier may hold. Enforced again server-side per tier. */
export const READ_ONLY_SCOPES = ["orders:read", "wallet:read", "catalog:read"] as const;

export const apiKeySchema = z.object({
  name: trimmed.min(1, { error: "required" }).max(60, { error: "tooLong" }),
  scopes: z
    .array(z.enum(API_SCOPES, { error: "invalidSelection" }))
    .min(1, { error: "selectAtLeastOne" }),
});

export const idSchema = z.uuid({ error: "invalidSelection" });

export const WEBHOOK_EVENTS = [
  "order.created",
  "order.claimed",
  "order.shipped",
  "order.delivered",
  "order.cancelled",
  "wallet.low_balance",
] as const;

/**
 * Webhook targets are fetched by our own servers, so an unvalidated URL is an
 * SSRF primitive. HTTPS only, and no loopback / link-local / RFC1918 hosts.
 */
const PRIVATE_HOST =
  /^(localhost$|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|\[?fc|\[?fd)/i;

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export const webhookSchema = z.object({
  // Every check is self-contained: zod v4 runs all refinements even after one
  // fails, so none of them may assume an earlier one passed.
  url: trimmed
    .min(1, { error: "required" })
    .max(512, { error: "tooLong" })
    .refine((v) => parseUrl(v) !== null, { error: "invalidUrl" })
    .refine((v) => {
      const url = parseUrl(v);
      return url === null || url.protocol === "https:";
    }, { error: "httpsOnly" })
    .refine((v) => {
      const url = parseUrl(v);
      return url === null || !PRIVATE_HOST.test(url.hostname);
    }, { error: "publicUrlOnly" }),
  events: z
    .array(z.enum(WEBHOOK_EVENTS, { error: "invalidSelection" }))
    .min(1, { error: "selectAtLeastOne" }),
});

/* ── Team seats ────────────────────────────────────────────────────────── */

export const SEAT_ROLES = ["member", "manager"] as const;

export const seatSchema = z.object({
  email: emailSchema,
  role: z.enum(SEAT_ROLES, { error: "invalidSelection" }),
});

/* ── Merchant branding (co-branded claim pages) ────────────────────────── */

export const brandingSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(80, { error: "tooLong" })
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .default(null),
  logoUrl: z
    .string()
    .trim()
    .max(512, { error: "tooLong" })
    .refine((v) => {
      if (v.length === 0) return true;
      try {
        return new URL(v).protocol === "https:";
      } catch {
        return false;
      }
    }, { error: "httpsOnly" })
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .default(null),
});

/* ── Order filtering ───────────────────────────────────────────────────── */

export const ORDER_STATUSES = [
  "draft",
  "awaiting_payment",
  "paid",
  "awaiting_recipient",
  "claimed",
  "ready_to_ship",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;

export const orderStatusFilterSchema = z.enum(ORDER_STATUSES).nullable().catch(null);

/**
 * `?page=` for the paginated history tables. Junk, negatives and absurdly deep
 * pages all collapse to page 1 instead of throwing or asking Postgres for a
 * multi-million-row offset.
 */
export const pageParamSchema = z.coerce.number().int().min(1).max(100_000).catch(1);

/**
 * `?q=` for the order history search.
 *
 * PostgREST treats `,` `(` `)` and `.` as syntax inside an `or=` filter, and
 * `%` `_` as LIKE wildcards, so those are stripped rather than escaped — a
 * stray character can never change the shape of the query. Same rules the
 * catalogue search uses.
 */
export const orderSearchSchema = z
  .string()
  .transform((raw) =>
    raw
      .replace(/[%_,().*\\"':;]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80),
  )
  .catch("");

/** Tokens for an order search: every token must match one of the fields. */
export function orderSearchTokens(term: string): string[] {
  return term.split(" ").filter(Boolean).slice(0, 4);
}

/* ── Turning zod issues into localised copy ────────────────────────────── */

/**
 * One message per field, keyed by the input's `name` — the same shape the
 * marketing forms already use, so `<TextField error={…}>` can consume it
 * directly.
 */
export type FieldErrors = Record<string, string>;

/** Interpolate `{name}` placeholders in a dictionary string. */
export function interpolate(text: string, vars?: Record<string, string>): string {
  if (!vars) return text;
  let out = text;
  for (const [name, value] of Object.entries(vars)) out = out.replaceAll(`{${name}}`, value);
  return out;
}

/** Read one entry from `dict.validation`, falling back to the generic copy. */
export function messageFor(
  validation: Record<string, string>,
  key: string,
  fallback: string,
  vars?: Record<string, string>,
): string {
  return interpolate(validation[key] ?? fallback, vars);
}

/**
 * Collapse a ZodError into localised `{ field: message }`.
 *
 * zod carries stable keys ("passwordTooShort"), never English sentences, so
 * the translation happens here — once, on the server, where the locale is
 * already known. Unknown keys degrade to the generic "check the fields" copy
 * rather than surfacing an internal identifier.
 */
export function translateIssues(
  error: z.ZodError<unknown>,
  validation: Record<string, string>,
  fallback: string,
  vars?: Record<string, string>,
): FieldErrors {
  const flat = z.flattenError(error);
  const out: FieldErrors = {};
  for (const [field, messages] of Object.entries(flat.fieldErrors)) {
    const first = (messages as string[] | undefined)?.[0];
    if (first) out[field] = messageFor(validation, first, fallback, vars);
  }
  if (flat.formErrors.length > 0 && flat.formErrors[0]) {
    out._form = messageFor(validation, flat.formErrors[0], fallback, vars);
  }
  return out;
}
