import "server-only";
import { supabaseService } from "@/lib/supabase/server";
import {
  centsToDecimalString,
  lineAmount,
  sumCents,
  tieredUnitPrice,
  toCents,
} from "@/lib/money";
import { effectiveMoq, privilegesFor, tierUnitPriceCents, type Tier } from "@/lib/tiers";
import { generateClaimToken, itemsDigest, type DigestItem } from "@/lib/crypto";
import { canTransition, type ActorKind, type OrderStatus } from "@/lib/db-types";
import { auditLog } from "@/lib/auth";
import type { Locale } from "@/i18n/config";

/** Order numbers: EIG-YYYYMMDD-XXXXX (5 random base32 chars). */
export function generateOrderNumber(date: Date = new Date()): string {
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/-/g, "");
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford: no I/L/O/U
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(5)))
    .map((b) => alphabet[b % alphabet.length])
    .join("");
  return `EIG-${stamp}-${rand}`;
}

export interface RequestedItem {
  /** Either an ELECT-I SKU or a product id must be given. */
  sku?: string;
  productId?: string;
  qty: number;
  /**
   * Only honoured for a line carrying NO sku/productId (an upstream custom
   * item). A line that names a catalog item is ALWAYS repriced from the DB and
   * is rejected outright if it does not resolve.
   */
  fallbackName?: string;
  fallbackUnitPriceCents?: number;
  externalSku?: string;
}

export interface PricedLine {
  productId: string | null;
  name: string;
  sku: string | null;
  externalSku: string | null;
  qty: number;
  unitPriceCents: number;
  amountCents: number;
  isCustom: boolean;
}

export interface PricedOrder {
  lines: PricedLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
}

/**
 * Reprice a set of requested lines from the database at the given tier.
 *
 * Client-sent prices are never trusted: every line that maps to a catalog
 * product is priced from `eig.products` plus its quantity breaks plus the
 * tier discount. Only lines with no catalog match may carry a caller price,
 * and those are flagged `isCustom`.
 */
export async function priceItems(items: RequestedItem[], tier: Tier): Promise<PricedOrder> {
  if (items.length === 0) throw new Error("An order needs at least one line");

  const service = supabaseService();
  const skus = items.map((i) => i.sku).filter((s): s is string => Boolean(s));
  const ids = items.map((i) => i.productId).filter((s): s is string => Boolean(s));

  const products = new Map<string, Record<string, unknown>>();
  if (skus.length || ids.length) {
    const filters: string[] = [];
    if (skus.length) filters.push(`sku.in.(${skus.join(",")})`);
    if (ids.length) filters.push(`id.in.(${ids.join(",")})`);
    const { data } = await service
      .from("products")
      .select("id, sku, name_en, list_price, moq, active, product_price_breaks(min_qty, unit_price)")
      .or(filters.join(","));
    for (const row of data ?? []) {
      products.set(row.sku as string, row);
      products.set(row.id as string, row);
    }
  }

  const lines: PricedLine[] = [];
  let listTotalCents = 0;

  for (const item of items) {
    if (!Number.isSafeInteger(item.qty) || item.qty < 1) {
      throw new Error(`Invalid quantity for ${item.sku ?? item.productId ?? "line"}`);
    }

    const key = item.sku ?? item.productId ?? "";
    const product = products.get(key);

    if (!product) {
      // A line that NAMES a catalog item must resolve to one. Falling back to
      // the caller's price here would let anyone quote a real SKU and set its
      // price themselves — the exact guarantee this function exists to keep.
      if (item.sku || item.productId) {
        throw new Error(`Unknown product "${key}"`);
      }
      // No identifier at all — an upstream custom line. Allowed, but it must
      // carry its own name and price, and is recorded as custom so it is
      // obvious in the order history.
      if (!item.fallbackName || item.fallbackUnitPriceCents === undefined) {
        throw new Error(`Unknown product "${key}" and no fallback name/price supplied`);
      }
      if (!Number.isSafeInteger(item.fallbackUnitPriceCents) || item.fallbackUnitPriceCents < 0) {
        throw new Error(`Invalid fallback price for "${key}"`);
      }
      const amountCents = lineAmount(item.fallbackUnitPriceCents, item.qty);
      lines.push({
        productId: null,
        name: item.fallbackName,
        sku: null,
        externalSku: item.externalSku ?? null,
        qty: item.qty,
        unitPriceCents: item.fallbackUnitPriceCents,
        amountCents,
        isCustom: true,
      });
      listTotalCents += amountCents;
      continue;
    }

    if (!product.active) throw new Error(`Product ${product.sku} is not available`);

    const minQty = effectiveMoq(Number(product.moq ?? 1), tier);
    if (item.qty < minQty) {
      throw new Error(`Minimum order quantity for ${product.sku} is ${minQty}`);
    }

    const listCents = toCents(String(product.list_price));
    const breaks = ((product.product_price_breaks as Array<Record<string, unknown>>) ?? []).map(
      (b) => ({
        minQty: Number(b.min_qty),
        unitPriceCents: toCents(String(b.unit_price)),
      }),
    );

    // Quantity break first, then the tier discount on top of it.
    const afterBreak = tieredUnitPrice(listCents, item.qty, breaks);
    const unitPriceCents = tierUnitPriceCents(afterBreak, tier);
    const amountCents = lineAmount(unitPriceCents, item.qty);

    lines.push({
      productId: product.id as string,
      name: product.name_en as string,
      sku: product.sku as string,
      externalSku: item.externalSku ?? null,
      qty: item.qty,
      unitPriceCents,
      amountCents,
      isCustom: false,
    });
    listTotalCents += lineAmount(afterBreak, item.qty);
  }

  const subtotalCents = sumCents(lines.map((l) => l.amountCents));
  return {
    lines,
    subtotalCents,
    // What the tier saved against break-price-only totals, for display.
    discountCents: Math.max(0, listTotalCents - subtotalCents),
    totalCents: subtotalCents,
  };
}

export interface CreateOnBehalfInput {
  merchantAccountId: string;
  merchantTier: Tier;
  items: RequestedItem[];
  /** HDML (or other upstream) order reference the recipient will be asked for. */
  externalRef: string;
  externalSource: string;
  /** Where the funds come from. */
  payFrom: "wallet" | "credit";
  idempotencyKey: string;
  recipientEmail?: string | null;
  /** Locale for the buyer's claim link + email. Defaults to "en". */
  recipientLocale?: Locale;
  buyerNote?: string | null;
  claimTtlDays?: number;
  /**
   * The upstream system's own snapshot of the buyer's order, and the digest
   * IT computed over that snapshot. Stored verbatim so the claim page can show
   * both sides, and used as the basis for ELECT-I's own `items_digest` so the
   * two are computed over identical data and can honestly be compared.
   */
  externalItems?: ExternalItemSnapshot[];
  externalDigest?: string | null;
}

export interface ExternalItemSnapshot {
  name: string;
  sku: string | null;
  qty: number;
  unitPriceCents: number;
  /** Upstream currency code, for display only (e.g. "EGP"). */
  currency?: string;
}

export interface CreatedOrder {
  orderId: string;
  orderNumber: string;
  claimToken: string;
  claimUrl: string;
  claimExpiresAt: string;
  totalCents: number;
  walletBalanceAfterCents: number | null;
  itemsDigest: string;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
}

/** How many prepaid orders this merchant has created in the current month. */
export async function onBehalfCountThisMonth(merchantAccountId: string): Promise<number> {
  const service = supabaseService();
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await service
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("merchant_account_id", merchantAccountId)
    .eq("on_behalf", true)
    .gte("created_at", start.toISOString());
  return count ?? 0;
}

/**
 * Create a prepaid order on a recipient's behalf and mint its claim link.
 *
 * The merchant pays here and now; the recipient supplies delivery details
 * later through the claim page and sees a zero balance. The caller MUST have
 * already authenticated and authorized the merchant — this function trusts
 * `merchantAccountId` and `merchantTier` as resolved server-side facts.
 */
export async function createOnBehalfOrder(input: CreateOnBehalfInput): Promise<CreatedOrder> {
  const service = supabaseService();
  const privileges = privilegesFor(input.merchantTier);

  if (!privileges.canOrderOnBehalf) {
    throw new Error("This tier cannot create prepaid orders on behalf of others");
  }

  // Replay protection: the same key always returns the original order.
  const { data: existing } = await service
    .from("orders")
    .select("id, order_number, claim_token, claim_expires_at, total, items_digest")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (existing) {
    return {
      orderId: existing.id as string,
      orderNumber: existing.order_number as string,
      claimToken: existing.claim_token as string,
      claimUrl: claimUrlFor(existing.claim_token as string),
      claimExpiresAt: existing.claim_expires_at as string,
      totalCents: toCents(String(existing.total)),
      walletBalanceAfterCents: null,
      itemsDigest: existing.items_digest as string,
    };
  }

  if (privileges.onBehalfOrdersPerMonth !== null) {
    const used = await onBehalfCountThisMonth(input.merchantAccountId);
    if (used >= privileges.onBehalfOrdersPerMonth) {
      throw new Error(
        `Monthly prepaid order limit reached (${privileges.onBehalfOrdersPerMonth}). Upgrade for more.`,
      );
    }
  }

  const priced = await priceItems(input.items, input.merchantTier);
  const orderNumber = generateOrderNumber();
  const claimToken = generateClaimToken();
  const ttlDays = input.claimTtlDays ?? 30;
  const claimExpiresAt = new Date(Date.now() + ttlDays * 86_400_000).toISOString();

  // Digest the UPSTREAM snapshot when there is one: it is the only
  // representation both systems hold identically. Digesting priced.lines
  // instead compares ELECT-I's tier price against the buyer's retail price, so
  // every catalog order would report a mismatch and the claim page would
  // withhold the address form from a perfectly valid order.
  const externalItems = input.externalItems ?? [];
  const digestItems: DigestItem[] = externalItems.length
    ? externalItems.map((i) => ({
        sku: i.sku,
        name: i.name,
        qty: i.qty,
        unitPriceCents: i.unitPriceCents,
        currency: i.currency,
      }))
    : // No upstream snapshot (a manually created order): nothing to compare
      // against, so the digest simply seals what ELECT-I itself will ship.
      priced.lines.map((l) => ({
        sku: l.externalSku ?? l.sku,
        name: l.name,
        qty: l.qty,
        unitPriceCents: l.unitPriceCents,
      }));
  const digest = await itemsDigest(digestItems, input.externalRef);

  // Take the money BEFORE creating the order, so a failed charge can never
  // leave a claimable order that nobody paid for.
  let balanceAfterCents: number | null = null;
  if (input.payFrom === "wallet") {
    const { data: newBalance, error } = await service.rpc("apply_wallet_txn", {
      p_account_id: input.merchantAccountId,
      p_kind: "charge",
      p_amount: centsToDecimalString(-priced.totalCents),
      p_order_id: null,
      p_idempotency_key: `order:${input.idempotencyKey}`,
      p_note: `Prepaid order ${orderNumber}`,
    });
    if (error) {
      throw new Error(
        error.message.includes("insufficient")
          ? "Insufficient wallet balance"
          : `Wallet charge failed: ${error.message}`,
      );
    }
    balanceAfterCents = toCents(String(newBalance));
  } else {
    if (privileges.creditLimitCents <= 0) {
      throw new Error("This tier has no credit line");
    }
    const { data: account } = await service
      .from("accounts")
      .select("credit_limit, credit_used")
      .eq("user_id", input.merchantAccountId)
      .single();
    const limit = toCents(String(account?.credit_limit ?? "0"));
    const used = toCents(String(account?.credit_used ?? "0"));
    if (used + priced.totalCents > limit) throw new Error("Credit limit exceeded");
    const { error } = await service
      .from("accounts")
      .update({ credit_used: centsToDecimalString(used + priced.totalCents) })
      .eq("user_id", input.merchantAccountId);
    if (error) throw new Error(`Credit draw failed: ${error.message}`);
  }

  const { data: order, error: orderError } = await service
    .from("orders")
    .insert({
      order_number: orderNumber,
      status: "awaiting_recipient",
      merchant_account_id: input.merchantAccountId,
      on_behalf: true,
      external_source: input.externalSource,
      external_ref: input.externalRef,
      items_digest: digest,
      external_items: input.externalItems ?? [],
      external_digest: input.externalDigest ?? null,
      idempotency_key: input.idempotencyKey,
      claim_token: claimToken,
      claim_expires_at: claimExpiresAt,
      subtotal: centsToDecimalString(priced.subtotalCents),
      discount_total: centsToDecimalString(priced.discountCents),
      total: centsToDecimalString(priced.totalCents),
      // Prepaid: the recipient's balance is zero from the moment it exists.
      amount_paid: centsToDecimalString(priced.totalCents),
      payment_status: "paid",
      payment_provider: input.payFrom,
      recipient_email: input.recipientEmail ?? null,
      buyer_note: input.buyerNote ?? null,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    // Refund the charge rather than silently keeping the merchant's money.
    if (input.payFrom === "wallet") {
      await service.rpc("apply_wallet_txn", {
        p_account_id: input.merchantAccountId,
        p_kind: "refund",
        p_amount: centsToDecimalString(priced.totalCents),
        p_order_id: null,
        p_idempotency_key: `order-rollback:${input.idempotencyKey}`,
        p_note: `Rollback for failed order ${orderNumber}`,
      });
    }
    throw new Error(`Failed to create order: ${orderError?.message}`);
  }

  const orderId = order.id as string;

  const { error: itemsError } = await service.from("order_items").insert(
    priced.lines.map((line, index) => ({
      order_id: orderId,
      product_id: line.productId,
      name_snapshot: line.name,
      sku_snapshot: line.sku,
      external_sku: line.externalSku,
      unit_price: centsToDecimalString(line.unitPriceCents),
      qty: line.qty,
      amount: centsToDecimalString(line.amountCents),
      is_custom: line.isCustom,
      sort: index,
    })),
  );
  if (itemsError) throw new Error(`Failed to write order items: ${itemsError.message}`);

  await service.from("order_status_history").insert({
    order_id: orderId,
    from_status: null,
    to_status: "awaiting_recipient",
    actor: "merchant",
    actor_id: input.merchantAccountId,
    note: `Prepaid on behalf; upstream ref ${input.externalRef}`,
  });

  await auditLog("merchant", input.merchantAccountId, "order.created_on_behalf", "order", orderId, {
    order_number: orderNumber,
    total_cents: priced.totalCents,
    external_ref: input.externalRef,
  });

  // Email the buyer their claim link, if we have their address. Best-effort:
  // deduped, never throws — the merchant can also copy the link from the
  // dashboard, so a mail failure never strands the order.
  if (input.recipientEmail) {
    const { data: merchant } = await service
      .from("accounts")
      .select("brand_display_name, company_name, full_name")
      .eq("user_id", input.merchantAccountId)
      .maybeSingle();
    const merchantName =
      (merchant?.brand_display_name as string | null) ||
      (merchant?.company_name as string | null) ||
      (merchant?.full_name as string | null) ||
      null;

    const { sendClaimLinkEmail } = await import("@/lib/email/notify");
    await sendClaimLinkEmail({
      orderId,
      to: input.recipientEmail,
      lang: input.recipientLocale ?? "en",
      claimUrl: claimUrlFor(claimToken, input.recipientLocale ?? "en"),
      orderNumber,
      externalRef: input.externalRef,
      merchantName,
    }).catch((e) => console.error("claim link email failed:", e));
  }

  return {
    orderId,
    orderNumber,
    claimToken,
    claimUrl: claimUrlFor(claimToken),
    claimExpiresAt,
    totalCents: priced.totalCents,
    walletBalanceAfterCents: balanceAfterCents,
    itemsDigest: digest,
  };
}

export function claimUrlFor(token: string, locale = "en"): string {
  return `${siteUrl()}/${locale}/claim/${token}`;
}

/**
 * Move an order between statuses, validating against ORDER_TRANSITIONS and
 * recording history. Returns false when the transition is not allowed.
 */
export async function transitionOrder(
  orderId: string,
  to: OrderStatus,
  actor: ActorKind,
  actorId: string | null,
  note?: string,
): Promise<boolean> {
  const service = supabaseService();
  const { data: order } = await service
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return false;

  const from = order.status as OrderStatus;
  if (!canTransition(from, to)) return false;

  // Guarded by the current status so two concurrent transitions cannot both win.
  const { error } = await service
    .from("orders")
    .update({ status: to })
    .eq("id", orderId)
    .eq("status", from);
  if (error) return false;

  await service.from("order_status_history").insert({
    order_id: orderId,
    from_status: from,
    to_status: to,
    actor,
    actor_id: actorId,
    note: note ?? null,
  });
  return true;
}
