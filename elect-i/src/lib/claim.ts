import "server-only";
import { cookies } from "next/headers";
import { supabaseService } from "@/lib/supabase/server";
import { toCents } from "@/lib/money";
import { hmacHex, timingSafeEqual } from "@/lib/crypto";
import { auditLog } from "@/lib/auth";
import { rateLimitDetailed } from "@/lib/rate-limit";
import type { ExternalItemSnapshot } from "@/lib/orders";
import { transitionOrder } from "@/lib/orders";
import type { Locale } from "@/i18n/config";

/**
 * The claim flow.
 *
 * A prepaid order's claim token IS the secret (the recipient has no account),
 * so it is a 32-byte CSPRNG value and every lookup here uses the service role
 * after verifying it. On top of the token, the recipient must type the
 * reference of the order they placed upstream — that both proves they are the
 * intended person and is the moment we can show them a real comparison
 * between what they ordered and what will actually ship.
 */

const VERIFY_COOKIE_PREFIX = "eig_claim_";
const VERIFY_TTL_SECONDS = 60 * 60 * 6;
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_SECONDS = 15 * 60;

/**
 * What the visitor should see. Lockout is NOT a state here — it is the result
 * of submitting a wrong reference, and is reported by verifyClaimReference so
 * the gate can show it inline without losing the form.
 */
export type ClaimState =
  | { kind: "not_found" }
  | { kind: "expired"; ttlDays: number }
  | { kind: "already_claimed"; claimedAt: string; orderNumber: string }
  | { kind: "needs_verification"; orderNumber: string }
  | { kind: "ready"; claim: Claim };

export interface ClaimLine {
  name: string;
  sku: string | null;
  qty: number;
  unitPriceCents: number;
  amountCents: number;
}

export interface Claim {
  orderId: string;
  orderNumber: string;
  externalRef: string;
  externalSource: string;
  lines: ClaimLine[];
  externalLines: ExternalItemSnapshot[];
  /**
   * True ONLY when both systems independently produced the same item digest.
   * False also covers "nothing to compare" — always read it together with
   * `digestComparable` before telling the buyer anything.
   */
  digestsMatch: boolean;
  /** Whether a comparison happened at all: false when no upstream digest came. */
  digestComparable: boolean;
  totalCents: number;
  amountPaidCents: number;
  amountDueCents: number;
  merchantName: string | null;
  merchantLogoUrl: string | null;
  claimExpiresAt: string;
  /** Pre-filled from a previous partial visit, if any. */
  draft: RecipientDraft | null;
}

export interface RecipientDraft {
  name: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  address1: string;
  address2: string;
  postalCode: string;
  taxId: string;
  notes: string;
}

function verifyCookieName(token: string): string {
  // Cookie names cannot contain the full token safely; a short stable hash of
  // it keeps one cookie per claim without echoing the secret.
  let h = 0;
  for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) | 0;
  return `${VERIFY_COOKIE_PREFIX}${(h >>> 0).toString(36)}`;
}

async function verificationSignature(token: string): Promise<string> {
  const secret = process.env.EIG_CLAIM_SECRET;
  if (!secret) throw new Error("EIG_CLAIM_SECRET is not set");
  return hmacHex(`claim-verified:${token}`, secret);
}

async function hasVerifiedCookie(token: string): Promise<boolean> {
  const jar = await cookies();
  const value = jar.get(verifyCookieName(token))?.value;
  if (!value) return false;
  return timingSafeEqual(value, await verificationSignature(token));
}

async function setVerifiedCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(verifyCookieName(token), await verificationSignature(token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VERIFY_TTL_SECONDS,
  });
}

interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  external_ref: string | null;
  external_source: string | null;
  external_items: ExternalItemSnapshot[];
  external_digest: string | null;
  items_digest: string | null;
  claim_expires_at: string | null;
  claimed_at: string | null;
  total: string;
  amount_paid: string;
  merchant_account_id: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  recipient_country: string | null;
  recipient_city: string | null;
  recipient_address1: string | null;
  recipient_address2: string | null;
  recipient_postal_code: string | null;
  recipient_tax_id: string | null;
  recipient_notes: string | null;
}

async function fetchOrderByToken(token: string): Promise<OrderRow | null> {
  const service = supabaseService();
  const { data } = await service
    .from("orders")
    .select(
      "id, order_number, status, external_ref, external_source, external_items, external_digest, items_digest, claim_expires_at, claimed_at, total, amount_paid, merchant_account_id, recipient_name, recipient_email, recipient_phone, recipient_country, recipient_city, recipient_address1, recipient_address2, recipient_postal_code, recipient_tax_id, recipient_notes",
    )
    .eq("claim_token", token)
    .maybeSingle();
  return (data as OrderRow | null) ?? null;
}

/** Resolve what the visitor should see for this token, right now. */
export async function loadClaim(token: string): Promise<ClaimState> {
  if (!token || token.length < 20) return { kind: "not_found" };

  const order = await fetchOrderByToken(token);
  if (!order) return { kind: "not_found" };

  if (order.claimed_at) {
    return {
      kind: "already_claimed",
      claimedAt: order.claimed_at,
      orderNumber: order.order_number,
    };
  }

  if (order.claim_expires_at && new Date(order.claim_expires_at) < new Date()) {
    return { kind: "expired", ttlDays: 30 };
  }

  if (!(await hasVerifiedCookie(token))) {
    return { kind: "needs_verification", orderNumber: order.order_number };
  }

  return { kind: "ready", claim: await buildClaim(order) };
}

async function buildClaim(order: OrderRow): Promise<Claim> {
  const service = supabaseService();

  const { data: items } = await service
    .from("order_items")
    .select("name_snapshot, sku_snapshot, external_sku, unit_price, qty, amount, sort")
    .eq("order_id", order.id)
    .order("sort");

  const lines: ClaimLine[] = (items ?? []).map((i) => ({
    name: i.name_snapshot as string,
    sku: (i.external_sku as string | null) ?? (i.sku_snapshot as string | null),
    qty: i.qty as number,
    unitPriceCents: toCents(String(i.unit_price)),
    amountCents: toCents(String(i.amount)),
  }));

  let merchantName: string | null = null;
  let merchantLogoUrl: string | null = null;
  if (order.merchant_account_id) {
    const { data: merchant } = await service
      .from("accounts")
      .select("company_name, full_name, brand_display_name, brand_logo_url, tier")
      .eq("user_id", order.merchant_account_id)
      .maybeSingle();
    merchantName =
      (merchant?.brand_display_name as string | null) ||
      (merchant?.company_name as string | null) ||
      (merchant?.full_name as string | null) ||
      null;
    // Co-branding is an Elite privilege; a downgraded account stops showing
    // its logo without anyone having to remember to clear the field.
    if (merchant?.tier === "elite") {
      merchantLogoUrl = (merchant.brand_logo_url as string | null) ?? null;
    }
  }

  // No upstream digest means NOT COMPARED, which is not the same as verified.
  // Defaulting this to true made an unverifiable order indistinguishable from
  // a verified one for anything reading `digestsMatch` on its own.
  const digestComparable = Boolean(order.external_digest && order.items_digest);
  const digestsMatch =
    digestComparable &&
    timingSafeEqual(order.external_digest as string, order.items_digest as string);

  const totalCents = toCents(String(order.total));
  const amountPaidCents = toCents(String(order.amount_paid));

  const hasDraft = Boolean(order.recipient_name || order.recipient_address1);

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    externalRef: order.external_ref ?? "",
    externalSource: order.external_source ?? "",
    lines,
    externalLines: Array.isArray(order.external_items) ? order.external_items : [],
    digestsMatch,
    digestComparable,
    totalCents,
    amountPaidCents,
    amountDueCents: Math.max(0, totalCents - amountPaidCents),
    merchantName,
    merchantLogoUrl,
    claimExpiresAt: order.claim_expires_at ?? "",
    draft: hasDraft
      ? {
          name: order.recipient_name ?? "",
          email: order.recipient_email ?? "",
          phone: order.recipient_phone ?? "",
          country: order.recipient_country ?? "",
          city: order.recipient_city ?? "",
          address1: order.recipient_address1 ?? "",
          address2: order.recipient_address2 ?? "",
          postalCode: order.recipient_postal_code ?? "",
          taxId: order.recipient_tax_id ?? "",
          notes: order.recipient_notes ?? "",
        }
      : null,
  };
}

/**
 * Check the upstream order reference the recipient typed.
 *
 * Rate-limited per token so the reference cannot be brute-forced, and
 * compared in constant time. On success a signed, httpOnly cookie means they
 * do not have to retype it while completing the form.
 */
export async function verifyClaimReference(
  token: string,
  reference: string,
): Promise<{ ok: true } | { ok: false; reason: "mismatch" | "locked"; retryInMinutes?: number }> {
  const limit = await rateLimitDetailed(`claim:${token}`, MAX_ATTEMPTS, ATTEMPT_WINDOW_SECONDS);
  if (!limit.allowed) {
    return { ok: false, reason: "locked", retryInMinutes: Math.ceil(limit.resetInSeconds / 60) };
  }

  const order = await fetchOrderByToken(token);
  if (!order?.external_ref) return { ok: false, reason: "mismatch" };

  const supplied = reference.trim().toUpperCase();
  const expected = order.external_ref.trim().toUpperCase();
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    await auditLog("recipient", null, "claim.verify_failed", "order", order.id, {
      attempts_remaining: limit.remaining,
    });
    return { ok: false, reason: "mismatch" };
  }

  await setVerifiedCookie(token);
  await auditLog("recipient", null, "claim.verified", "order", order.id);
  return { ok: true };
}

/**
 * Persist the recipient's details without completing the claim, so a visitor
 * who closes the tab mid-form does not lose their typing.
 */
export async function saveClaimDraft(token: string, draft: Partial<RecipientDraft>): Promise<void> {
  if (!(await hasVerifiedCookie(token))) throw new Error("Not verified");
  const order = await fetchOrderByToken(token);
  if (!order || order.claimed_at) throw new Error("Claim not open");

  const service = supabaseService();
  await service
    .from("orders")
    .update({
      recipient_name: draft.name ?? null,
      recipient_email: draft.email ?? null,
      recipient_phone: draft.phone ?? null,
      recipient_country: draft.country ?? null,
      recipient_city: draft.city ?? null,
      recipient_address1: draft.address1 ?? null,
      recipient_address2: draft.address2 ?? null,
      recipient_postal_code: draft.postalCode ?? null,
      recipient_tax_id: draft.taxId ?? null,
      recipient_notes: draft.notes ?? null,
    })
    .eq("id", order.id)
    .is("claimed_at", null);
}

/** Complete the claim: record the recipient and release the order to shipping. */
export async function submitClaim(
  token: string,
  details: RecipientDraft,
  /** Language the buyer just used, so the confirmation reads like the page. */
  locale: Locale = "en",
): Promise<{ ok: true; orderNumber: string } | { ok: false; reason: string }> {
  if (!(await hasVerifiedCookie(token))) return { ok: false, reason: "not_verified" };

  const order = await fetchOrderByToken(token);
  if (!order) return { ok: false, reason: "not_found" };
  if (order.claimed_at) return { ok: false, reason: "already_claimed" };
  if (order.claim_expires_at && new Date(order.claim_expires_at) < new Date()) {
    return { ok: false, reason: "expired" };
  }

  const service = supabaseService();
  const { error } = await service
    .from("orders")
    .update({
      recipient_name: details.name,
      recipient_email: details.email,
      recipient_phone: details.phone,
      recipient_country: details.country,
      recipient_city: details.city,
      recipient_address1: details.address1,
      recipient_address2: details.address2 || null,
      recipient_postal_code: details.postalCode || null,
      recipient_tax_id: details.taxId || null,
      recipient_notes: details.notes || null,
      claimed_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    // Guard makes a double submit a no-op rather than a second claim.
    .is("claimed_at", null);
  if (error) return { ok: false, reason: error.message };

  await transitionOrder(order.id, "claimed", "recipient", null, "Recipient confirmed delivery details");
  await transitionOrder(order.id, "ready_to_ship", "system", null, "Released to fulfilment");

  await auditLog("recipient", null, "claim.submitted", "order", order.id, {
    order_number: order.order_number,
  });

  const { queueWebhook } = await import("@/lib/webhooks");
  await queueWebhook(order.merchant_account_id, "order.claimed", {
    order_id: order.id,
    order_number: order.order_number,
    external_ref: order.external_ref,
    claimed_at: new Date().toISOString(),
  });

  // Confirmation to the buyer. Best-effort and deduped, exactly like the claim
  // link email: the claim is already committed above, so a mail outage must
  // never turn a successful submit into an error the buyer sees.
  try {
    const { sendClaimConfirmationEmail } = await import("@/lib/email/notify");
    await sendClaimConfirmationEmail({
      orderId: order.id,
      to: details.email,
      toName: details.name,
      lang: locale,
      orderNumber: order.order_number,
      externalRef: order.external_ref ?? "",
      destination: [details.city, details.country].filter(Boolean).join(", "),
    });
  } catch (e) {
    console.error("claim confirmation email failed:", e);
  }

  return { ok: true, orderNumber: order.order_number };
}
