import "server-only";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/server";
import { toPiasters } from "@/lib/money";

/**
 * HDML -> ELECT-I Global integration client.
 *
 * When the owner approves a payment here, HDML places a matching PREPAID order
 * on ELECT-I Global (which handles international fulfilment) and stores the
 * claim link on the order so the buyer can enter their delivery address there.
 *
 * The two systems talk over ELECT-I's signed merchant API. HDML holds a
 * merchant API key and signs each request with HMAC-SHA256. HDML also sends a
 * snapshot of the buyer's lines (`external_items`) plus a digest over it
 * (`external_digest`); ELECT-I independently recomputes the digest over the
 * snapshot it stored and the claim page compares the two. Both sides therefore
 * digest the SAME canonical data — ELECT-I's own tier pricing is deliberately
 * not part of it, because a catalog line is repriced there and would make
 * every real order look mismatched.
 *
 * The whole integration is gated on env config; when it is absent every entry
 * point below no-ops with `{ enabled: false }` so the store runs unchanged.
 */

interface EigConfig {
  baseUrl: string;
  keyId: string;
  secret: string;
  /** EGP per USD, for converting HDML prices to ELECT-I's USD catalogue. */
  egpPerUsd: number;
  source: string;
}

function readConfig(): EigConfig | null {
  const baseUrl = process.env.EIG_API_BASE_URL;
  const keyId = process.env.EIG_API_KEY_ID;
  const secret = process.env.EIG_API_SECRET;
  if (!baseUrl || !keyId || !secret) return null;
  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    keyId,
    secret,
    egpPerUsd: Number(process.env.EIG_EGP_PER_USD ?? "51") || 51,
    // ELECT-I shows this in its dashboard, so it must never name this store.
    source: process.env.EIG_SOURCE ?? "storefront",
  };
}

export function isEigEnabled(): boolean {
  return readConfig() !== null;
}

/* ── Signing (mirrors elect-i/src/lib/crypto.ts) ─────────────────────────── */

const encoder = new TextEncoder();

async function hmacHex(message: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface DigestItem {
  sku: string | null;
  name: string;
  qty: number;
  unitPriceCents: number;
  /** Currency of `unitPriceCents`; sealed so a swap cannot go unnoticed. */
  currency?: string | null;
}

/**
 * MUST match ELECT-I's `itemsDigest` byte for byte: same normalisation, same
 * ordering, same secret (the shared EIG_CLAIM_SECRET). Any divergence would
 * make every order look mismatched on the claim page.
 *
 * Exported for the cross-system test that pins the two implementations
 * together — nothing else should call it.
 */
export async function itemsDigest(
  items: DigestItem[],
  externalRef: string,
  claimSecret: string,
): Promise<string> {
  const normalised = items
    .map((i) => {
      const sku = (i.sku ?? "").trim().toUpperCase();
      const name = i.name.trim().toLowerCase().replace(/\s+/g, " ");
      // USD is the platform currency, so an omitted currency and an explicit
      // "USD" must digest identically.
      const currency = (i.currency ?? "USD").trim().toUpperCase();
      return `${sku}|${name}|${i.qty}|${i.unitPriceCents}|${currency}`;
    })
    .sort()
    .join("\n");
  return hmacHex(`${externalRef.trim().toUpperCase()}\n${normalised}`, claimSecret);
}

/* ── Response parsing ────────────────────────────────────────────────────── */

/**
 * A 2xx is not by itself a success: without an order id AND a claim URL there
 * is nothing worth storing and the buyer has no way to finish the handoff, so
 * an unexpected body is treated as a failed push rather than a silent one.
 */
const createdOrderSchema = z.object({
  order_id: z.string().trim().min(1),
  order_number: z.string().trim().min(1),
  claim_url: z.url(),
});

/** GET /api/v1/orders/:id — only the fields the claim-link repair path needs. */
const orderDetailSchema = z.object({
  order_id: z.string().trim().min(1),
  order_number: z.string().trim().min(1).nullish(),
  claim_url: z.url().nullish(),
});

/** ELECT-I's error envelope, for a message the owner can act on. */
const apiErrorSchema = z.object({
  error: z.object({ code: z.string().optional(), message: z.string() }),
});

export type ParsedCreatedOrder =
  | { ok: true; orderId: string; orderNumber: string; claimUrl: string }
  | { ok: false; error: string };

/** Exported for unit tests; the push path is the only real caller. */
export function parseEigCreatedOrder(payload: unknown): ParsedCreatedOrder {
  const parsed = createdOrderSchema.safeParse(payload);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".") || "body").join(", ");
    return { ok: false, error: `ELECT-I response missing or invalid: ${missing}` };
  }
  return {
    ok: true,
    orderId: parsed.data.order_id,
    orderNumber: parsed.data.order_number,
    claimUrl: parsed.data.claim_url,
  };
}

function errorMessage(payload: unknown, status: number): string {
  const parsed = apiErrorSchema.safeParse(payload);
  return parsed.success ? parsed.data.error.message : `HTTP ${status}`;
}

/* ── Order push ──────────────────────────────────────────────────────────── */

export interface EigPushResult {
  enabled: boolean;
  ok: boolean;
  orderId?: string;
  orderNumber?: string;
  claimUrl?: string;
  error?: string;
  /** How an `ok` result came about, so the admin UI can say something true. */
  outcome?: "created" | "existing" | "recovered";
}

/**
 * One signed call to ELECT-I. GET is signed over an empty body, exactly as the
 * server verifies it.
 */
async function signedRequest(
  config: EigConfig,
  method: "GET" | "POST",
  path: string,
  body: string,
): Promise<Response> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const signature = await hmacHex([timestamp, method, path, nonce, body].join("\n"), config.secret);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "x-eig-key-id": config.keyId,
        "x-eig-timestamp": timestamp,
        "x-eig-nonce": nonce,
        "x-eig-signature": signature,
      },
      ...(method === "POST" ? { body } : {}),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Recover the claim link for an ELECT-I order we already created. Used when a
 * previous push stored an order id but no claim URL: re-POSTing would rely on
 * the idempotency key alone, so a plain read is both cheaper and safer.
 */
async function fetchEigClaimUrl(config: EigConfig, eigOrderId: string): Promise<EigPushResult> {
  try {
    const response = await signedRequest(
      config,
      "GET",
      `/api/v1/orders/${encodeURIComponent(eigOrderId)}`,
      "",
    );
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        enabled: true,
        ok: false,
        error: `claim link lookup failed: ${errorMessage(payload, response.status)}`,
      };
    }

    const parsed = orderDetailSchema.safeParse(payload);
    if (!parsed.success || !parsed.data.claim_url) {
      return { enabled: true, ok: false, error: "ELECT-I returned no claim link for this order" };
    }
    return {
      enabled: true,
      ok: true,
      orderId: parsed.data.order_id,
      orderNumber: parsed.data.order_number ?? undefined,
      claimUrl: parsed.data.claim_url,
      outcome: "recovered",
    };
  } catch (error) {
    return {
      enabled: true,
      ok: false,
      error: error instanceof Error ? error.message : "request failed",
    };
  }
}

/**
 * Create the prepaid ELECT-I order for a HDML order that has just been marked
 * paid. Idempotent on the HDML order ref, so a retried approval never creates
 * a second ELECT-I order.
 *
 * Prices: HDML lines are EGP; ELECT-I is priced in USD. Because HDML's exact
 * catalogue is mirrored into ELECT-I, lines are sent by name + converted unit
 * price as CUSTOM lines (no SKU mapping is assumed here), and the digest is
 * computed over those same converted values so both sides agree.
 *
 * Also self-healing: an order that already has an ELECT-I id but lost its
 * claim URL gets the URL re-read rather than the order re-created.
 */
export async function pushOrderToEig(orderId: string): Promise<EigPushResult> {
  const config = readConfig();
  if (!config) return { enabled: false, ok: false };

  const claimSecret = process.env.EIG_CLAIM_SECRET;
  if (!claimSecret) {
    return { enabled: true, ok: false, error: "EIG_CLAIM_SECRET not set" };
  }

  const service = supabaseService();
  const { data: order } = await service
    .from("orders")
    .select("id, order_ref, email, eig_order_id, eig_order_number, eig_claim_url")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { enabled: true, ok: false, error: "order not found" };

  // Already pushed — return the stored result rather than calling again. Both
  // halves must be present: an order id with no claim URL is a half-written
  // row, and short-circuiting on the id alone is what made a retry unable to
  // repair it while still reporting success.
  if (order.eig_order_id && order.eig_claim_url) {
    return {
      enabled: true,
      ok: true,
      orderId: order.eig_order_id as string,
      orderNumber: (order.eig_order_number as string | null) ?? undefined,
      claimUrl: order.eig_claim_url as string,
      outcome: "existing",
    };
  }

  // The ELECT-I order exists but we never stored its claim link. Fetch it
  // instead of re-creating; the idempotency key would return the same order
  // anyway, but a read cannot charge the wallet a second time by accident.
  if (order.eig_order_id) {
    return fetchEigClaimUrl(config, order.eig_order_id as string);
  }

  const { data: items } = await service
    .from("order_items")
    .select("name_snapshot, sku_snapshot, unit_price, qty")
    .eq("order_id", orderId)
    .order("id");
  if (!items || items.length === 0) {
    return { enabled: true, ok: false, error: "order has no items" };
  }

  // EGP -> USD cents, once per line, shared by the payload and the digest.
  const lines = items.map((i) => {
    const unitPiasters = toPiasters(String(i.unit_price));
    const unitUsdCents = Math.round(unitPiasters / config.egpPerUsd);
    return {
      name: i.name_snapshot as string,
      sku: (i.sku_snapshot as string | null) ?? null,
      qty: i.qty as number,
      unitPriceCents: unitUsdCents,
      currency: "USD",
    };
  });

  const externalRef = order.order_ref as string;
  const digest = await itemsDigest(lines, externalRef, claimSecret);

  const body = JSON.stringify({
    idempotency_key: `hdml:${externalRef}`,
    external_ref: externalRef,
    external_source: config.source,
    on_behalf: true,
    pay_from: "wallet",
    recipient_email: (order.email as string) ?? null,
    items: lines.map((l) => ({
      name: l.name,
      // Omitted rather than sent as null: a HDML custom line genuinely has no
      // SKU, and `null` is not an absent optional to the receiving schema.
      ...(l.sku ? { external_sku: l.sku } : {}),
      qty: l.qty,
      unit_price_cents: l.unitPriceCents,
    })),
    // HDML's independent snapshot + digest, for the claim page comparison.
    external_items: lines.map((l) => ({
      name: l.name,
      sku: l.sku,
      qty: l.qty,
      unit_price_cents: l.unitPriceCents,
      currency: l.currency,
    })),
    external_digest: digest,
  });

  try {
    const response = await signedRequest(config, "POST", "/api/v1/orders", body);
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return { enabled: true, ok: false, error: errorMessage(payload, response.status) };
    }

    // A 2xx with an unusable body is a failure, not a push: recording it as
    // 'pushed' would strand the buyer with no claim link and no retry.
    const parsed = parseEigCreatedOrder(payload);
    if (!parsed.ok) return { enabled: true, ok: false, error: parsed.error };

    return {
      enabled: true,
      ok: true,
      orderId: parsed.orderId,
      orderNumber: parsed.orderNumber,
      claimUrl: parsed.claimUrl,
      outcome: "created",
    };
  } catch (error) {
    return {
      enabled: true,
      ok: false,
      error: error instanceof Error ? error.message : "request failed",
    };
  }
}

/**
 * Push, then persist the outcome on the order. Best-effort by contract: this
 * NEVER throws, so a failed ELECT-I call cannot roll back a payment approval.
 * A failure is recorded as `eig_status='failed'` for retry from the admin UI.
 */
export async function pushAndRecord(orderId: string): Promise<EigPushResult> {
  if (!isEigEnabled()) {
    const service = supabaseService();
    await service.from("orders").update({ eig_status: "skipped" }).eq("id", orderId);
    return { enabled: false, ok: false };
  }

  let result: EigPushResult;
  try {
    result = await pushOrderToEig(orderId);
  } catch (error) {
    result = {
      enabled: true,
      ok: false,
      error: error instanceof Error ? error.message : "unexpected error",
    };
  }

  const service = supabaseService();

  // 'pushed' is a promise that the claim link is on the order, so it is only
  // written with BOTH ids present. Anything less stays 'failed' and retryable.
  if (result.ok && result.orderId && result.claimUrl) {
    await service
      .from("orders")
      .update({
        eig_order_id: result.orderId,
        eig_order_number: result.orderNumber ?? null,
        eig_claim_url: result.claimUrl,
        eig_status: "pushed",
        eig_error: null,
        eig_pushed_at: new Date().toISOString(),
      })
      .eq("id", orderId);
    return result;
  }

  const error =
    result.error ?? (result.ok ? "ELECT-I returned no order id or claim link" : "unknown");
  await service
    .from("orders")
    .update({ eig_status: "failed", eig_error: error })
    .eq("id", orderId);

  // Report what was actually stored: the caller's message is derived from this.
  return { ...result, ok: false, error };
}
