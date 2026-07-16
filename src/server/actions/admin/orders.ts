"use server";

/**
 * Admin order mutations: status transitions, custom line items, proof review,
 * invoice regeneration and email resends.
 *
 * Every action authorizes with requireAdmin() BEFORE touching
 * supabaseService(), and records an audit entry on success.
 */

import { refresh } from "next/cache";
import { requireAdmin, auditLog } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/settings";
import { sendEmail } from "@/lib/email/brevo";
import { proofRejectedHtml, proofRejectedSubject } from "@/lib/email/templates";
import { ensureInvoice, sendOrderEmail } from "@/lib/invoice-service";
import { lineAmount, piastersToDecimalString, toPiasters } from "@/lib/money";
import {
  adminInvoiceActionSchema,
  adminOrderItemRemoveSchema,
  adminOrderStatusSchema,
  customLineItemSchema,
  parseOrErrors,
  proofReviewSchema,
} from "@/lib/validation";
import {
  ORDER_STATUS_LABELS,
  ORDER_TRANSITIONS,
  type Order,
  type OrderStatus,
  type PaymentProof,
} from "@/lib/db-types";
import {
  failure,
  fdInt,
  fdString,
  success,
  type ActionState,
} from "@/server/actions/admin/action-result";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function loadOrder(orderId: string): Promise<Order | null> {
  const service = supabaseService();
  const { data } = await service.from("orders").select("*").eq("id", orderId).maybeSingle();
  return (data as Order | null) ?? null;
}

/** Recompute subtotal (catalog lines) / adjustment (custom lines) / total. */
async function recomputeOrderTotals(orderId: string): Promise<void> {
  const service = supabaseService();
  const { data: items, error } = await service
    .from("order_items")
    .select("amount, is_custom")
    .eq("order_id", orderId);
  if (error) throw new Error(`Failed to load order items: ${error.message}`);

  let subtotal = 0;
  let adjustment = 0;
  for (const it of (items ?? []) as Array<{ amount: number; is_custom: boolean }>) {
    const p = toPiasters(String(it.amount));
    if (it.is_custom) adjustment += p;
    else subtotal += p;
  }
  const { error: updateError } = await service
    .from("orders")
    .update({
      subtotal: piastersToDecimalString(subtotal),
      adjustment_total: piastersToDecimalString(adjustment),
      total: piastersToDecimalString(subtotal + adjustment),
    })
    .eq("id", orderId);
  if (updateError) throw new Error(`Failed to update order totals: ${updateError.message}`);
}

async function insertHistory(
  orderId: string,
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
  adminId: string,
  reason: string | null,
): Promise<void> {
  const service = supabaseService();
  const { error } = await service.from("order_status_history").insert({
    order_id: orderId,
    from_status: fromStatus,
    to_status: toStatus,
    actor: "admin",
    actor_id: adminId,
    reason,
  });
  if (error) console.error("order_status_history insert failed:", error.message);
}

// ---------------------------------------------------------------------------
// Status transition
// ---------------------------------------------------------------------------

export async function transitionOrderStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(adminOrderStatusSchema, {
    orderId: fdString(formData, "orderId"),
    toStatus: fdString(formData, "toStatus"),
    reason: fdString(formData, "reason"),
  });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);
  const { orderId, toStatus, reason } = parsed.data;

  const order = await loadOrder(orderId);
  if (!order) return failure("Order not found");
  if (!ORDER_TRANSITIONS[order.status].includes(toStatus)) {
    return failure(
      `Illegal transition: ${ORDER_STATUS_LABELS[order.status]} → ${ORDER_STATUS_LABELS[toStatus]}`,
    );
  }

  const service = supabaseService();
  const { error } = await service.from("orders").update({ status: toStatus }).eq("id", orderId);
  if (error) return failure(`Update failed: ${error.message}`);

  await insertHistory(orderId, order.status, toStatus, admin.id, reason || null);

  let emailNote = "";
  if (toStatus === "paid") {
    // Best-effort: manual confirmation should also deliver the final receipt.
    const result = await sendOrderEmail(orderId, "final");
    emailNote = result.sent
      ? " Final receipt email sent."
      : ` Final receipt email failed (${result.error ?? "unknown"}) — resend from the Invoices panel.`;
  }

  await auditLog(admin.id, "order.status_change", "orders", orderId, {
    from: order.status,
    to: toStatus,
    reason: reason || null,
    order_ref: order.order_ref,
  });
  refresh();
  return success(`Status changed to ${ORDER_STATUS_LABELS[toStatus]}.${emailNote}`);
}

// ---------------------------------------------------------------------------
// Custom line items
// ---------------------------------------------------------------------------

export async function addCustomLineItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(customLineItemSchema, {
    orderId: fdString(formData, "orderId"),
    name: fdString(formData, "name"),
    unitPrice: fdString(formData, "unitPrice"),
    qty: fdInt(formData, "qty", 1),
  });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);
  const { orderId, name, unitPrice, qty } = parsed.data;

  const order = await loadOrder(orderId);
  if (!order) return failure("Order not found");

  let unitPiasters: number;
  let amountPiasters: number;
  try {
    unitPiasters = toPiasters(unitPrice);
    amountPiasters = lineAmount(unitPiasters, qty);
  } catch (e) {
    return failure(e instanceof Error ? e.message : "Invalid amount");
  }

  const service = supabaseService();
  const { error } = await service.from("order_items").insert({
    order_id: orderId,
    product_id: null,
    name_snapshot: name,
    sku_snapshot: null,
    unit_price: piastersToDecimalString(unitPiasters),
    qty,
    amount: piastersToDecimalString(amountPiasters),
    is_custom: true,
  });
  if (error) return failure(`Insert failed: ${error.message}`);

  try {
    await recomputeOrderTotals(orderId);
  } catch (e) {
    return failure(e instanceof Error ? e.message : "Totals recompute failed");
  }

  await auditLog(admin.id, "order.custom_item_add", "orders", orderId, {
    name,
    unit_price: unitPrice,
    qty,
    order_ref: order.order_ref,
  });
  refresh();
  return success(`Added "${name}".`);
}

export async function removeCustomLineItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(adminOrderItemRemoveSchema, {
    orderId: fdString(formData, "orderId"),
    itemId: fdString(formData, "itemId"),
  });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);
  const { orderId, itemId } = parsed.data;

  const service = supabaseService();
  const { data: item } = await service
    .from("order_items")
    .select("id, is_custom, name_snapshot, order_id")
    .eq("id", itemId)
    .eq("order_id", orderId)
    .maybeSingle();
  if (!item) return failure("Line item not found");
  if (!item.is_custom) return failure("Only custom line items can be removed");

  const { error } = await service.from("order_items").delete().eq("id", itemId);
  if (error) return failure(`Delete failed: ${error.message}`);

  try {
    await recomputeOrderTotals(orderId);
  } catch (e) {
    return failure(e instanceof Error ? e.message : "Totals recompute failed");
  }

  await auditLog(admin.id, "order.custom_item_remove", "orders", orderId, {
    item_id: itemId,
    name: item.name_snapshot,
  });
  refresh();
  return success("Custom item removed.");
}

// ---------------------------------------------------------------------------
// Proof review
// ---------------------------------------------------------------------------

export async function reviewProofAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(proofReviewSchema, {
    proofId: fdString(formData, "proofId"),
    decision: fdString(formData, "decision"),
    reason: fdString(formData, "reason"),
  });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);
  const { proofId, decision, reason } = parsed.data;

  const service = supabaseService();
  const { data: proofRow } = await service
    .from("payment_proofs")
    .select("*")
    .eq("id", proofId)
    .maybeSingle();
  const proof = proofRow as PaymentProof | null;
  if (!proof) return failure("Proof not found");
  if (proof.status !== "pending") return failure("This proof has already been reviewed");

  const order = await loadOrder(proof.order_id);
  if (!order) return failure("Order not found");

  if (decision === "approved") {
    const { error } = await service
      .from("payment_proofs")
      .update({
        status: "approved",
        review_reason: reason || null,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", proofId);
    if (error) return failure(`Update failed: ${error.message}`);

    let statusNote = "";
    if (ORDER_TRANSITIONS[order.status].includes("paid")) {
      const { error: orderError } = await service
        .from("orders")
        .update({ status: "paid" })
        .eq("id", order.id);
      if (orderError) return failure(`Order update failed: ${orderError.message}`);
      await insertHistory(order.id, order.status, "paid", admin.id, "Payment proof approved");
      statusNote = " Order marked Paid.";
    }

    await auditLog(admin.id, "proof.approve", "payment_proofs", proofId, {
      order_id: order.id,
      order_ref: order.order_ref,
    });

    // Best-effort final receipt email.
    const result = await sendOrderEmail(order.id, "final");
    const emailNote = result.sent
      ? " Final receipt email sent."
      : ` Final email failed (${result.error ?? "unknown"}) — resend from the Invoices panel.`;
    refresh();
    return success(`Proof approved.${statusNote}${emailNote}`);
  }

  // decision === "rejected"
  if (!reason) return failure("A rejection reason is required", { reason: "Required" });

  const { error } = await service
    .from("payment_proofs")
    .update({
      status: "rejected",
      review_reason: reason,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", proofId);
  if (error) return failure(`Update failed: ${error.message}`);

  let statusNote = "";
  if (order.status === "awaiting_verification") {
    const { error: orderError } = await service
      .from("orders")
      .update({ status: "awaiting_payment" })
      .eq("id", order.id);
    if (orderError) return failure(`Order update failed: ${orderError.message}`);
    await insertHistory(
      order.id,
      order.status,
      "awaiting_payment",
      admin.id,
      `Payment proof rejected: ${reason}`,
    );
    statusNote = " Order moved back to Awaiting Payment.";
  }

  await auditLog(admin.id, "proof.reject", "payment_proofs", proofId, {
    order_id: order.id,
    order_ref: order.order_ref,
    reason,
  });

  // Best-effort rejection email, recorded in email_events (no dedupe — each
  // rejection is a distinct notification).
  const settings = await getSiteSettings();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  const subject = proofRejectedSubject(order.order_ref);
  const emailResult = await sendEmail({
    to: order.email,
    toName: order.customer_name,
    subject,
    html: proofRejectedHtml({
      customerName: order.customer_name,
      orderRef: order.order_ref,
      reason,
      trackingUrl: `${siteUrl}/order/${order.tracking_token}`,
      contact: {
        phone: settings.contact.phone,
        email: settings.contact.email,
        whatsapp: settings.contact.whatsapp,
      },
    }),
  });
  const { error: eventError } = await service.from("email_events").insert({
    order_id: order.id,
    kind: "proof_rejected",
    recipient: order.email,
    subject,
    status: emailResult.sent ? "sent" : "failed",
    error: emailResult.error ?? null,
    provider_message_id: emailResult.providerMessageId ?? null,
    attempts: 1,
    dedupe_key: null,
  });
  if (eventError) console.error("email_events insert failed:", eventError.message);

  refresh();
  const emailNote = emailResult.sent
    ? " Customer notified by email."
    : ` Notification email failed (${emailResult.error ?? "unknown"}).`;
  return success(`Proof rejected.${statusNote}${emailNote}`);
}

// ---------------------------------------------------------------------------
// Invoices & emails
// ---------------------------------------------------------------------------

function invoiceKindAllowed(kind: "preliminary" | "final", status: OrderStatus): boolean {
  return kind === "preliminary" || status === "paid" || status === "fulfilled";
}

export async function regenerateInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(adminInvoiceActionSchema, {
    orderId: fdString(formData, "orderId"),
    kind: fdString(formData, "kind"),
  });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);
  const { orderId, kind } = parsed.data;

  const order = await loadOrder(orderId);
  if (!order) return failure("Order not found");
  if (!invoiceKindAllowed(kind, order.status)) {
    return failure("The final invoice is only available once the order is paid or fulfilled");
  }

  try {
    await ensureInvoice(orderId, kind);
  } catch (e) {
    return failure(e instanceof Error ? e.message : "Invoice generation failed");
  }

  await auditLog(admin.id, "invoice.regenerate", "orders", orderId, {
    kind,
    order_ref: order.order_ref,
  });
  refresh();
  return success(`${kind === "preliminary" ? "Preliminary" : "Final"} invoice regenerated.`);
}

export async function resendOrderEmailAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(adminInvoiceActionSchema, {
    orderId: fdString(formData, "orderId"),
    kind: fdString(formData, "kind"),
  });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);
  const { orderId, kind } = parsed.data;

  const order = await loadOrder(orderId);
  if (!order) return failure("Order not found");
  if (!invoiceKindAllowed(kind, order.status)) {
    return failure("The final email is only available once the order is paid or fulfilled");
  }

  const result = await sendOrderEmail(orderId, kind, { force: true });

  await auditLog(admin.id, "email.resend", "orders", orderId, {
    kind,
    sent: result.sent,
    error: result.error ?? null,
    order_ref: order.order_ref,
  });
  refresh();
  return result.sent
    ? success(`${kind === "preliminary" ? "Preliminary" : "Final"} email re-sent to ${order.email}.`)
    : failure(`Send failed: ${result.error ?? "unknown error"}`);
}
