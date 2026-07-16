"use server";

/**
 * placeOrder: the ONLY way an order is created. Recomputes every price from
 * the database (client sends product ids + quantities only), enforces MOQ and
 * the EGP minimum order, and is idempotent per client-generated key so a
 * double-click or a retried request can never create two orders.
 */

import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/settings";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { orderRef } from "@/lib/order-ref";
import {
  formatEgp,
  lineAmount,
  piastersToDecimalString,
  sumPiasters,
  tieredUnitPrice,
  toPiasters,
} from "@/lib/money";
import { checkoutSchema } from "@/lib/validation";

export type PlaceOrderResult = { trackingToken: string } | { error: string };

interface CheckoutProductRow {
  id: string;
  name: string;
  sku: string;
  price: number;
  moq: number;
  stock_status: string;
  active: boolean;
  product_price_tiers: Array<{ min_qty: number; unit_price: number }> | null;
}

const MAX_REF_BUMPS = 30;

export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  const user = await requireUser("/checkout");

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Your order could not be validated. Please review the form and try again." };
  }
  const order = parsed.data;

  const ip = clientIpFrom(await headers());
  if (!(await verifyTurnstile(order.turnstileToken, ip))) {
    return { error: "Human verification failed. Please try again." };
  }
  if (!(await rateLimit(`checkout:${user.id}`, 10, 3600))) {
    return { error: "Too many checkout attempts. Please try again later." };
  }
  if (!(await rateLimit(`checkout-ip:${ip}`, 20, 3600))) {
    return { error: "Too many checkout attempts. Please try again later." };
  }

  // Authorized above (requireUser); everything below uses the service client
  // so pricing cannot be affected by RLS edge cases.
  const service = supabaseService();

  // ------------------------------------------------------------------
  // Idempotency: an existing order for this key IS the result.
  // ------------------------------------------------------------------
  const { data: existing } = await service
    .from("orders")
    .select("tracking_token")
    .eq("idempotency_key", order.idempotencyKey)
    .maybeSingle();
  if (existing?.tracking_token) {
    return { trackingToken: existing.tracking_token as string };
  }

  // ------------------------------------------------------------------
  // Re-fetch and re-price every line from the DB.
  // ------------------------------------------------------------------
  const productIds = order.items.map((i) => i.productId);
  const { data: productRows, error: productsError } = await service
    .from("products")
    .select(
      "id, name, sku, price, moq, stock_status, active, product_price_tiers(min_qty, unit_price)",
    )
    .in("id", productIds);
  if (productsError) {
    console.error("placeOrder products fetch failed:", productsError.message);
    return { error: "We could not load your products. Please try again." };
  }
  const products = new Map(
    ((productRows ?? []) as unknown as CheckoutProductRow[]).map((p) => [p.id, p]),
  );

  const lines: Array<{
    product_id: string;
    name_snapshot: string;
    sku_snapshot: string;
    unit_price: string;
    qty: number;
    amount: string;
    amountPiasters: number;
  }> = [];

  for (const item of order.items) {
    const product = products.get(item.productId);
    if (!product || !product.active) {
      return { error: "Some items are no longer available. Please review your cart." };
    }
    if (product.stock_status === "out_of_stock") {
      return { error: `This product is no longer available: ${product.name}` };
    }
    if (item.qty < product.moq) {
      return {
        error: `"${product.name}" has a minimum order quantity of ${product.moq}. Please adjust your cart.`,
      };
    }
    const tiers = (product.product_price_tiers ?? []).map((t) => ({
      minQty: t.min_qty,
      unitPricePiasters: toPiasters(String(t.unit_price)),
    }));
    const unit = tieredUnitPrice(toPiasters(String(product.price)), item.qty, tiers);
    const amount = lineAmount(unit, item.qty);
    lines.push({
      product_id: product.id,
      name_snapshot: product.name,
      sku_snapshot: product.sku,
      unit_price: piastersToDecimalString(unit),
      qty: item.qty,
      amount: piastersToDecimalString(amount),
      amountPiasters: amount,
    });
  }

  const subtotal = sumPiasters(lines.map((l) => l.amountPiasters));

  const settings = await getSiteSettings();
  const minPiasters = toPiasters(String(settings.ordering.min_order_egp));
  if (subtotal < minPiasters) {
    return {
      error: `The minimum order is ${formatEgp(minPiasters)}. Your cart total is ${formatEgp(subtotal)}.`,
    };
  }

  // ------------------------------------------------------------------
  // Payment method label snapshot.
  // ------------------------------------------------------------------
  const { data: method } = await service
    .from("payment_methods")
    .select("id, label, number, active")
    .eq("id", order.paymentMethodId)
    .maybeSingle();
  if (!method || !method.active) {
    return { error: "The selected payment method is unavailable. Please pick another." };
  }

  // ------------------------------------------------------------------
  // Insert the order; retry the time-based ref on 23505 collisions.
  // ------------------------------------------------------------------
  const now = new Date();
  let orderId: string | null = null;
  let trackingToken: string | null = null;

  for (let bump = 0; bump <= MAX_REF_BUMPS; bump++) {
    const ref = orderRef(now, bump);
    const { data: inserted, error: insertError } = await service
      .from("orders")
      .insert({
        order_ref: ref,
        customer_id: user.id,
        status: "awaiting_payment",
        payment_method_id: method.id,
        payment_method_label: `${method.label} ${method.number}`.trim(),
        customer_name: order.customerName,
        phone: order.phone,
        email: order.email,
        company_name: order.companyName || null,
        tax_id: order.taxId || null,
        governorate: order.governorate,
        address: order.address,
        subtotal: piastersToDecimalString(subtotal),
        adjustment_total: "0",
        total: piastersToDecimalString(subtotal),
        currency: "EGP",
        idempotency_key: order.idempotencyKey,
        customer_note: order.customerNote || null,
      })
      .select("id, tracking_token")
      .single();

    if (!insertError && inserted) {
      orderId = inserted.id as string;
      trackingToken = inserted.tracking_token as string;
      break;
    }

    if (insertError?.code === "23505") {
      // Unique violation. If it is the idempotency key, a concurrent request
      // with the same key won the race — return its order.
      if (insertError.message.includes("idempotency")) {
        const { data: winner } = await service
          .from("orders")
          .select("tracking_token")
          .eq("idempotency_key", order.idempotencyKey)
          .maybeSingle();
        if (winner?.tracking_token) return { trackingToken: winner.tracking_token as string };
        return { error: "Your order could not be created. Please try again." };
      }
      // Otherwise the order_ref second is taken — bump and retry.
      continue;
    }

    console.error("placeOrder order insert failed:", insertError?.message);
    return { error: "Your order could not be created. Please try again." };
  }

  if (!orderId || !trackingToken) {
    return { error: "Your order could not be created. Please try again in a moment." };
  }

  // ------------------------------------------------------------------
  // Items (+ compensating cleanup so a half-written order never survives).
  // ------------------------------------------------------------------
  const { error: itemsError } = await service.from("order_items").insert(
    lines.map((l) => ({
      order_id: orderId,
      product_id: l.product_id,
      name_snapshot: l.name_snapshot,
      sku_snapshot: l.sku_snapshot,
      unit_price: l.unit_price,
      qty: l.qty,
      amount: l.amount,
      is_custom: false,
    })),
  );
  if (itemsError) {
    console.error("placeOrder items insert failed:", itemsError.message);
    const { error: cleanupError } = await service.from("orders").delete().eq("id", orderId);
    if (cleanupError) {
      console.error("placeOrder compensating delete failed:", cleanupError.message);
    }
    return { error: "Your order could not be created. Please try again." };
  }

  const { error: historyError } = await service.from("order_status_history").insert({
    order_id: orderId,
    from_status: null,
    to_status: "awaiting_payment",
    actor: "system",
    reason: "Order placed",
  });
  if (historyError) {
    // Bookkeeping only — the order itself is complete.
    console.error("placeOrder history insert failed:", historyError.message);
  }

  // No email here: the preliminary receipt goes out after the payment proof
  // is uploaded.
  return { trackingToken };
}
