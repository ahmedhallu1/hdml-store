import { authenticate, authErrorResponse, apiError, hasScope } from "../../_lib/authenticate";
import { supabaseService } from "@/lib/supabase/server";
import { claimUrlFor } from "@/lib/orders";

/** GET /api/v1/orders/:id — full detail for one of the caller's orders. */
export async function GET(request: Request, { params }: RouteContext<"/api/v1/orders/[id]">) {
  const auth = await authenticate(request, "");
  if (!auth.ok) return authErrorResponse(auth.reason);
  const { caller } = auth;

  if (!hasScope(caller, "orders:read")) {
    return apiError("forbidden", "This key cannot read orders", 403);
  }

  const { id } = await params;
  const service = supabaseService();

  const { data: order } = await service
    .from("orders")
    .select(
      "id, order_number, status, external_ref, external_source, items_digest, claim_token, claim_expires_at, claimed_at, subtotal, discount_total, total, amount_paid, amount_due, currency, payment_status, recipient_name, recipient_country, recipient_city, tracking_carrier, tracking_number, created_at, updated_at, merchant_account_id",
    )
    .eq("id", id)
    .maybeSingle();

  // Same 404 whether the order is missing or belongs to another merchant —
  // an existence oracle would leak order ids across accounts.
  if (!order || order.merchant_account_id !== caller.accountId) {
    return apiError("not_found", "Order not found", 404);
  }

  const { data: items } = await service
    .from("order_items")
    .select("name_snapshot, sku_snapshot, external_sku, unit_price, qty, amount, sort")
    .eq("order_id", id)
    .order("sort");

  return Response.json({
    order_id: order.id,
    order_number: order.order_number,
    status: order.status,
    external_ref: order.external_ref,
    external_source: order.external_source,
    items_digest: order.items_digest,
    claim_url: order.claim_token ? claimUrlFor(order.claim_token as string) : null,
    claim_expires_at: order.claim_expires_at,
    claimed_at: order.claimed_at,
    subtotal: order.subtotal,
    discount_total: order.discount_total,
    total: order.total,
    amount_paid: order.amount_paid,
    amount_due: order.amount_due,
    currency: order.currency,
    payment_status: order.payment_status,
    // Only coarse recipient data over the API — the merchant paid for the
    // order but does not need the buyer's full address to reconcile it.
    recipient: order.claimed_at
      ? {
          name: order.recipient_name,
          country: order.recipient_country,
          city: order.recipient_city,
        }
      : null,
    tracking: order.tracking_number
      ? { carrier: order.tracking_carrier, number: order.tracking_number }
      : null,
    items: (items ?? []).map((i) => ({
      name: i.name_snapshot,
      sku: i.sku_snapshot,
      external_sku: i.external_sku,
      unit_price: i.unit_price,
      qty: i.qty,
      amount: i.amount,
    })),
    created_at: order.created_at,
    updated_at: order.updated_at,
  });
}
