import { z } from "zod";
import { authenticate, authErrorResponse, apiError, canWrite, hasScope } from "../_lib/authenticate";
import { createOnBehalfOrder, type ExternalItemSnapshot } from "@/lib/orders";
import { centsToDecimalString } from "@/lib/money";
import { queueWebhook } from "@/lib/webhooks";
import { supabaseService } from "@/lib/supabase/server";

/**
 * POST /api/v1/orders
 *
 * Create a prepaid order on a recipient's behalf and return its claim link.
 * This is the endpoint a merchant's own storefront calls the moment it
 * confirms a customer's payment upstream.
 */

const itemSchema = z
  .object({
    sku: z.string().trim().min(1).max(64).optional(),
    product_id: z.uuid().optional(),
    qty: z.int().min(1).max(1_000_000),
    // Required for an external line, which carries its own name and price.
    name: z.string().trim().min(1).max(300).optional(),
    unit_price_cents: z.int().min(0).max(99_999_999).optional(),
    // The caller's own SKU, for reconciliation. Nullable because an upstream
    // custom line genuinely has none, and a caller should not have to choose
    // between omitting the key and sending an explicit "no SKU".
    external_sku: z.string().trim().max(64).nullish(),
  })
  // Every request here is on_behalf, so a line the merchant is ordering FOR
  // someone else may be an upstream custom line with no ELECT-I catalog match.
  // Such a line must still be fully specified: name + price, or it cannot be
  // priced at all. A line that DOES name a sku/product_id is still required to
  // resolve to a real product (enforced in priceItems).
  .refine((i) => i.sku || i.product_id || (i.name && i.unit_price_cents !== undefined), {
    message: "Each item needs sku, product_id, or name + unit_price_cents",
  });

const externalItemSchema = z.object({
  name: z.string().trim().min(1).max(300),
  sku: z.string().trim().max(64).nullable().default(null),
  qty: z.int().min(1),
  unit_price_cents: z.int().min(0),
  currency: z.string().trim().length(3).optional(),
});

const bodySchema = z.object({
  idempotency_key: z.string().trim().min(8).max(128),
  external_ref: z.string().trim().min(3).max(64),
  // Never default to a customer's own brand: this value is shown in the
  // dashboard order list, and naming an integrating merchant there would leak
  // who they are. "storefront" describes the channel without identifying one.
  external_source: z.string().trim().min(2).max(32).default("storefront"),
  on_behalf: z.literal(true),
  pay_from: z.enum(["wallet", "credit"]).default("wallet"),
  items: z.array(itemSchema).min(1).max(200),
  recipient_email: z.email().max(200).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  claim_ttl_days: z.int().min(1).max(120).optional(),
  /** The caller's own snapshot of the buyer's order, for the claim page. */
  external_items: z.array(externalItemSchema).max(200).optional(),
  /** The digest the caller computed over external_items. */
  external_digest: z.string().trim().length(64).optional(),
});

export async function POST(request: Request) {
  const rawBody = await request.text();

  const auth = await authenticate(request, rawBody);
  if (!auth.ok) return authErrorResponse(auth.reason);
  const { caller } = auth;

  if (!hasScope(caller, "orders:write") || !canWrite(caller)) {
    return apiError("forbidden", "This key cannot create orders", 403);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return apiError("invalid_json", "Request body is not valid JSON", 400);
  }

  const parsed = bodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: "invalid_request",
          message: "Request failed validation",
          details: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
      },
      { status: 422 },
    );
  }
  const body = parsed.data;

  const externalItems: ExternalItemSnapshot[] = (body.external_items ?? []).map((i) => ({
    name: i.name,
    sku: i.sku,
    qty: i.qty,
    unitPriceCents: i.unit_price_cents,
    currency: i.currency,
  }));

  try {
    const created = await createOnBehalfOrder({
      merchantAccountId: caller.accountId,
      merchantTier: caller.tier,
      items: body.items.map((i) => ({
        sku: i.sku,
        productId: i.product_id,
        qty: i.qty,
        fallbackName: i.name,
        fallbackUnitPriceCents: i.unit_price_cents,
        externalSku: i.external_sku ?? undefined,
      })),
      externalRef: body.external_ref,
      externalSource: body.external_source,
      payFrom: body.pay_from,
      idempotencyKey: body.idempotency_key,
      recipientEmail: body.recipient_email ?? null,
      buyerNote: body.note ?? null,
      claimTtlDays: body.claim_ttl_days,
      externalItems,
      externalDigest: body.external_digest ?? null,
    });

    await queueWebhook(caller.accountId, "order.created", {
      order_id: created.orderId,
      order_number: created.orderNumber,
      external_ref: body.external_ref,
      claim_url: created.claimUrl,
    });

    // Low-balance signal so a merchant is never surprised by a declined order.
    if (created.walletBalanceAfterCents !== null && created.walletBalanceAfterCents < 50_000) {
      await queueWebhook(caller.accountId, "wallet.low_balance", {
        balance: centsToDecimalString(created.walletBalanceAfterCents),
        currency: "USD",
      });
    }

    return Response.json(
      {
        order_id: created.orderId,
        order_number: created.orderNumber,
        status: "awaiting_recipient",
        claim_url: created.claimUrl,
        claim_expires_at: created.claimExpiresAt,
        amount_charged: centsToDecimalString(created.totalCents),
        currency: "USD",
        wallet_balance_after:
          created.walletBalanceAfterCents === null
            ? null
            : centsToDecimalString(created.walletBalanceAfterCents),
        items_digest: created.itemsDigest,
        digest_matches: body.external_digest
          ? body.external_digest === created.itemsDigest
          : null,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Order creation failed";

    if (message.includes("Insufficient wallet balance")) {
      return apiError("insufficient_funds", message, 402);
    }
    if (message.includes("Credit limit")) return apiError("credit_limit", message, 402);
    if (message.includes("Monthly prepaid order limit")) {
      return apiError("quota_exceeded", message, 429);
    }
    if (message.includes("Minimum order quantity")) return apiError("moq_not_met", message, 422);
    if (message.includes("Unknown product") || message.includes("not available")) {
      return apiError("unknown_product", message, 422);
    }

    console.error("order creation failed:", error);
    return apiError("server_error", "Order could not be created", 500);
  }
}

/** GET /api/v1/orders — list the caller's orders, newest first. */
export async function GET(request: Request) {
  const auth = await authenticate(request, "");
  if (!auth.ok) return authErrorResponse(auth.reason);
  const { caller } = auth;

  if (!hasScope(caller, "orders:read")) {
    return apiError("forbidden", "This key cannot read orders", 403);
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 25, 100);
  const status = url.searchParams.get("status");

  const service = supabaseService();
  let query = service
    .from("orders")
    .select(
      "id, order_number, status, external_ref, total, amount_paid, claim_token, claim_expires_at, claimed_at, tracking_carrier, tracking_number, created_at",
    )
    .eq("merchant_account_id", caller.accountId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return apiError("server_error", "Could not list orders", 500);

  return Response.json({
    data: (data ?? []).map((o) => ({
      order_id: o.id,
      order_number: o.order_number,
      status: o.status,
      external_ref: o.external_ref,
      total: o.total,
      amount_paid: o.amount_paid,
      claim_expires_at: o.claim_expires_at,
      claimed_at: o.claimed_at,
      tracking: o.tracking_number
        ? { carrier: o.tracking_carrier, number: o.tracking_number }
        : null,
      created_at: o.created_at,
    })),
  });
}
