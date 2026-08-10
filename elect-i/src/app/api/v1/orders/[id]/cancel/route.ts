import {
  authenticate,
  authErrorResponse,
  apiError,
  canWrite,
  hasScope,
} from "../../../_lib/authenticate";
import { supabaseService } from "@/lib/supabase/server";
import { transitionOrder } from "@/lib/orders";
import { centsToDecimalString, toCents } from "@/lib/money";
import { queueWebhook } from "@/lib/webhooks";

/**
 * POST /api/v1/orders/:id/cancel
 *
 * Cancels an unclaimed prepaid order and returns the money to the wallet it
 * came from. Refusing to cancel once the recipient has claimed is deliberate:
 * at that point goods are queued against a real address.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/v1/orders/[id]/cancel">) {
  const rawBody = await request.text();

  const auth = await authenticate(request, rawBody);
  if (!auth.ok) return authErrorResponse(auth.reason);
  const { caller } = auth;

  if (!hasScope(caller, "orders:write") || !canWrite(caller)) {
    return apiError("forbidden", "This key cannot modify orders", 403);
  }

  const { id } = await params;
  const service = supabaseService();

  const { data: order } = await service
    .from("orders")
    .select("id, status, total, merchant_account_id, payment_provider, claimed_at, order_number")
    .eq("id", id)
    .maybeSingle();

  if (!order || order.merchant_account_id !== caller.accountId) {
    return apiError("not_found", "Order not found", 404);
  }
  if (order.claimed_at) {
    return apiError("already_claimed", "This order has already been claimed and cannot be cancelled", 409);
  }

  const moved = await transitionOrder(id, "cancelled", "merchant", caller.accountId, "Cancelled via API");
  if (!moved) {
    return apiError("invalid_state", `Cannot cancel an order in status "${order.status}"`, 409);
  }

  const totalCents = toCents(String(order.total));
  let refunded = false;

  if (order.payment_provider === "wallet") {
    const { error } = await service.rpc("apply_wallet_txn", {
      p_account_id: caller.accountId,
      p_kind: "refund",
      p_amount: centsToDecimalString(totalCents),
      p_order_id: id,
      // Keyed on the order, so a retried cancel refunds exactly once.
      p_idempotency_key: `cancel:${id}`,
      p_note: `Cancelled order ${order.order_number}`,
    });
    refunded = !error;
    if (error) console.error("refund on cancel failed:", error.message);
  } else if (order.payment_provider === "credit") {
    const { data: account } = await service
      .from("accounts")
      .select("credit_used")
      .eq("user_id", caller.accountId)
      .single();
    const used = toCents(String(account?.credit_used ?? "0"));
    await service
      .from("accounts")
      .update({ credit_used: centsToDecimalString(Math.max(0, used - totalCents)) })
      .eq("user_id", caller.accountId);
    refunded = true;
  }

  await queueWebhook(caller.accountId, "order.cancelled", {
    order_id: id,
    order_number: order.order_number,
    refunded,
  });

  return Response.json({
    order_id: id,
    status: "cancelled",
    refunded,
    refund_amount: refunded ? centsToDecimalString(totalCents) : null,
  });
}
