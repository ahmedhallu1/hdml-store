"use server";

/**
 * Admin order mutations: status transitions, custom line items, proof review,
 * invoice regeneration and email resends.
 *
 * Every action authorizes with requireAdmin() BEFORE touching
 * supabaseService(), and records an audit entry on success.
 */

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, auditLog } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/settings";
import { sendEmail } from "@/lib/email/brevo";
import { proofRejectedHtml, proofRejectedSubject } from "@/lib/email/templates";
import { ensureInvoice, sendOrderEmail } from "@/lib/invoice-service";
import { isEigEnabled, pushAndRecord, type EigPushResult } from "@/lib/eig/client";
import { lineAmount, piastersToDecimalString, toPiasters } from "@/lib/money";
import {
  adminInvoiceActionSchema,
  adminOrderDeleteSchema,
  adminOrderForceStatusSchema,
  adminOrderItemRemoveSchema,
  adminOrderStatusSchema,
  adminProofDecisionSchema,
  adminProofDeleteSchema,
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

  // Any already-issued receipt now shows a stale total — regenerate it so the
  // customer's download link never contradicts the amount they must transfer.
  const { data: existingInvoices } = await service
    .from("invoices")
    .select("kind")
    .eq("order_id", orderId);
  for (const inv of (existingInvoices ?? []) as Array<{ kind: "preliminary" | "final" }>) {
    try {
      await ensureInvoice(orderId, inv.kind);
    } catch (e) {
      console.error(`invoice regeneration (${inv.kind}) failed for ${orderId}:`, e);
    }
  }
}

/**
 * What actually happened on the ELECT-I side, in the owner's words.
 *
 * A claim link is only ever promised when one was really stored — the old
 * wording said it unconditionally, including for pushes that wrote NULL.
 */
function eigSuccessNote(result: EigPushResult): string {
  if (!result.claimUrl) {
    return "ELECT-I accepted the order but returned no claim link — retry, or open the order in ELECT-I.";
  }
  switch (result.outcome) {
    case "existing":
      return "This order was already on ELECT-I; its claim link is on the order.";
    case "recovered":
      return "This order was already on ELECT-I; its missing claim link has been recovered and stored.";
    default:
      return "ELECT-I order created; the claim link is on the order.";
  }
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
  // Conditional on the status the transition was validated against, so two
  // concurrent admins cannot materialize an illegal path (e.g. cancelled→paid).
  const { data: updated, error } = await service
    .from("orders")
    .update({ status: toStatus })
    .eq("id", orderId)
    .eq("status", order.status)
    .select("id");
  if (error) return failure(`Update failed: ${error.message}`);
  if (!updated?.length) {
    return failure("The order status changed while you were editing — reload and try again.");
  }

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
// Owner overrides: set any status, delete an order outright
// ---------------------------------------------------------------------------

/**
 * Set an order to ANY status, bypassing ORDER_TRANSITIONS.
 *
 * transitionOrderStatusAction stays the everyday path (it enforces the legal
 * flow and sends the receipt email); this one exists so the owner can correct a
 * record that is simply wrong — e.g. an order that was marked paid by mistake,
 * or one that needs to go back to "awaiting payment" after a chargeback.
 */
export async function setOrderStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(adminOrderForceStatusSchema, {
    orderId: fdString(formData, "orderId"),
    toStatus: fdString(formData, "toStatus"),
    reason: fdString(formData, "reason"),
  });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);
  const { orderId, toStatus, reason } = parsed.data;

  const order = await loadOrder(orderId);
  if (!order) return failure("Order not found");
  if (order.status === toStatus) {
    return failure(`This order is already ${ORDER_STATUS_LABELS[toStatus]}.`);
  }

  const service = supabaseService();
  const { data: updated, error } = await service
    .from("orders")
    .update({ status: toStatus })
    .eq("id", orderId)
    .eq("status", order.status)
    .select("id");
  if (error) return failure(`Update failed: ${error.message}`);
  if (!updated?.length) {
    return failure("The order status changed while you were editing — reload and try again.");
  }

  await insertHistory(
    orderId,
    order.status,
    toStatus,
    admin.id,
    reason ? `Manual correction: ${reason}` : "Manual correction by admin",
  );
  await auditLog(admin.id, "order.status_override", "orders", orderId, {
    from: order.status,
    to: toStatus,
    reason: reason || null,
    order_ref: order.order_ref,
  });
  refresh();
  return success(
    `Status set to ${ORDER_STATUS_LABELS[toStatus]}. No email was sent — use the Invoices panel if the customer should be notified.`,
  );
}

/**
 * Permanently delete an order. Items, status history, proofs and invoices go
 * with it (ON DELETE CASCADE); the stored proof/invoice files are removed from
 * their private buckets first so nothing is orphaned. Typing the order
 * reference is required so a stray click cannot destroy a record.
 */
export async function deleteOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(adminOrderDeleteSchema, {
    orderId: fdString(formData, "orderId"),
    confirmRef: fdString(formData, "confirmRef"),
  });
  if (!parsed.ok) {
    return failure("Type the order reference to confirm", parsed.errors);
  }
  const { orderId, confirmRef } = parsed.data;
  const returnTo = fdString(formData, "returnTo");

  const order = await loadOrder(orderId);
  if (!order) return failure("Order not found");
  if (confirmRef.trim().toUpperCase() !== order.order_ref.toUpperCase()) {
    return failure(`That reference does not match. Type ${order.order_ref} exactly.`, {
      confirmRef: "Does not match this order",
    });
  }

  const service = supabaseService();

  // Files first — a failure here is logged but must not block the deletion.
  const { data: proofs } = await service
    .from("payment_proofs")
    .select("storage_path")
    .eq("order_id", orderId);
  const proofPaths = ((proofs ?? []) as Array<{ storage_path: string }>)
    .map((p) => p.storage_path)
    .filter(Boolean);
  if (proofPaths.length) {
    const { error } = await service.storage.from("payment-proofs").remove(proofPaths);
    if (error) console.error("proof file cleanup failed:", error.message);
  }

  const { data: invoices } = await service
    .from("invoices")
    .select("pdf_path")
    .eq("order_id", orderId);
  const invoicePaths = ((invoices ?? []) as Array<{ pdf_path: string }>)
    .map((i) => i.pdf_path)
    .filter(Boolean);
  if (invoicePaths.length) {
    const { error } = await service.storage.from("invoices").remove(invoicePaths);
    if (error) console.error("invoice file cleanup failed:", error.message);
  }

  const { error: deleteError } = await service.from("orders").delete().eq("id", orderId);
  if (deleteError) return failure(`Delete failed: ${deleteError.message}`);

  await auditLog(admin.id, "order.delete", "orders", orderId, {
    order_ref: order.order_ref,
    customer_name: order.customer_name,
    email: order.email,
    total: order.total,
    status: order.status,
  });

  if (returnTo && returnTo.startsWith("/admin")) redirect(returnTo);
  redirect("/admin/orders");
}

// ---------------------------------------------------------------------------
// Proof maintenance (owner-side)
// ---------------------------------------------------------------------------

/** Change a proof's decision after the fact (including re-opening it). */
export async function setProofStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(adminProofDecisionSchema, {
    proofId: fdString(formData, "proofId"),
    status: fdString(formData, "status"),
    reason: fdString(formData, "reason"),
  });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);
  const { proofId, status, reason } = parsed.data;

  const service = supabaseService();
  const { data: proofRow } = await service
    .from("payment_proofs")
    .select("*")
    .eq("id", proofId)
    .maybeSingle();
  const proof = proofRow as PaymentProof | null;
  if (!proof) return failure("Proof not found");

  const { error } = await service
    .from("payment_proofs")
    .update({
      status,
      review_reason: reason || null,
      reviewed_by: status === "pending" ? null : admin.id,
      reviewed_at: status === "pending" ? null : new Date().toISOString(),
    })
    .eq("id", proofId);
  if (error) return failure(`Update failed: ${error.message}`);

  await auditLog(admin.id, "proof.set_status", "payment_proofs", proofId, {
    order_id: proof.order_id,
    to: status,
    reason: reason || null,
  });
  refresh();
  return success(
    `Proof marked ${status}. The order status was left untouched — change it separately if needed.`,
  );
}

/** Remove a proof record (and its stored file). */
export async function deleteProofAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(adminProofDeleteSchema, { proofId: fdString(formData, "proofId") });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);
  const { proofId } = parsed.data;

  const service = supabaseService();
  const { data: proofRow } = await service
    .from("payment_proofs")
    .select("id, order_id, storage_path")
    .eq("id", proofId)
    .maybeSingle();
  if (!proofRow) return failure("Proof not found");
  const proof = proofRow as { id: string; order_id: string; storage_path: string };

  if (proof.storage_path) {
    const { error } = await service.storage.from("payment-proofs").remove([proof.storage_path]);
    if (error) console.error("proof file delete failed:", error.message);
  }
  const { error } = await service.from("payment_proofs").delete().eq("id", proofId);
  if (error) return failure(`Delete failed: ${error.message}`);

  await auditLog(admin.id, "proof.delete", "payment_proofs", proofId, {
    order_id: proof.order_id,
  });
  refresh();
  return success("Payment proof deleted.");
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
    // A proof may only be approved when the order can actually become paid —
    // otherwise a "payment confirmed" receipt would go out for an order that
    // is cancelled / already handled.
    const alreadyPaid = order.status === "paid" || order.status === "fulfilled";
    if (!alreadyPaid && !ORDER_TRANSITIONS[order.status].includes("paid")) {
      return failure(
        `Order is ${ORDER_STATUS_LABELS[order.status]} — approve is only possible while the payment can still be confirmed.`,
      );
    }

    // Optimistic guard: only flip a proof that is still pending (a concurrent
    // admin may have reviewed it between our read and this write).
    const { data: updatedProof, error } = await service
      .from("payment_proofs")
      .update({
        status: "approved",
        review_reason: reason || null,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", proofId)
      .eq("status", "pending")
      .select("id");
    if (error) return failure(`Update failed: ${error.message}`);
    if (!updatedProof?.length) return failure("This proof was reviewed by someone else just now.");

    let statusNote = "";
    let paidNow = alreadyPaid;
    if (!alreadyPaid) {
      // Conditional on the status we validated against — a concurrent
      // transition (e.g. cancelled) must not be overwritten to paid.
      const { data: updatedOrder, error: orderError } = await service
        .from("orders")
        .update({ status: "paid" })
        .eq("id", order.id)
        .eq("status", order.status)
        .select("id");
      if (orderError) return failure(`Order update failed: ${orderError.message}`);
      if (!updatedOrder?.length) {
        return failure(
          "The order status changed while reviewing — reload the page and check before approving again.",
        );
      }
      await insertHistory(order.id, order.status, "paid", admin.id, "Payment proof approved");
      statusNote = " Order marked Paid.";
      paidNow = true;
    }

    await auditLog(admin.id, "proof.approve", "payment_proofs", proofId, {
      order_id: order.id,
      order_ref: order.order_ref,
    });

    // Place the matching prepaid ELECT-I Global order BEFORE the receipt email,
    // so the claim link is available to include in it. Best-effort by
    // contract: pushAndRecord never throws, and a failure is recorded on the
    // order (eig_status='failed') for retry — it must never undo the approval.
    let eigNote = "";
    if (paidNow && isEigEnabled()) {
      const eig = await pushAndRecord(order.id);
      eigNote = eig.ok
        ? ` ${eigSuccessNote(eig)}`
        : ` ELECT-I push failed (${eig.error ?? "unknown"}) — retry from the order page.`;
    }

    // Best-effort final receipt email — only when the order really is paid.
    let emailNote = "";
    if (paidNow) {
      const result = await sendOrderEmail(order.id, "final");
      emailNote = result.sent
        ? " Final receipt email sent."
        : ` Final email failed (${result.error ?? "unknown"}) — resend from the Invoices panel.`;
    }
    refresh();
    return success(`Proof approved.${statusNote}${eigNote}${emailNote}`);
  }

  // decision === "rejected"
  if (!reason) return failure("A rejection reason is required", { reason: "Required" });

  const { data: rejectedProof, error } = await service
    .from("payment_proofs")
    .update({
      status: "rejected",
      review_reason: reason,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", proofId)
    .eq("status", "pending")
    .select("id");
  if (error) return failure(`Update failed: ${error.message}`);
  if (!rejectedProof?.length) return failure("This proof was reviewed by someone else just now.");

  let statusNote = "";
  if (order.status === "awaiting_verification") {
    const { error: orderError } = await service
      .from("orders")
      .update({ status: "awaiting_payment" })
      .eq("id", order.id)
      .eq("status", "awaiting_verification");
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

/**
 * Retry the ELECT-I Global push for a paid order whose earlier attempt failed
 * (or was made before the integration was configured). Idempotent: an order
 * that was already pushed returns its existing claim link, and one that was
 * pushed but never got its claim link stored has it re-read and repaired.
 */
export async function retryEigPushAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const orderId = fdString(formData, "orderId");
  if (!orderId) return failure("Invalid input");
  if (!isEigEnabled()) {
    return failure("ELECT-I Global integration is not configured (set EIG_API_* secrets).");
  }

  const order = await loadOrder(orderId);
  if (!order) return failure("Order not found");
  if (order.status !== "paid") {
    return failure("The ELECT-I order is only created once the payment is confirmed.");
  }

  const eig = await pushAndRecord(orderId);
  await auditLog(admin.id, "eig.retry", "orders", orderId, {
    ok: eig.ok,
    error: eig.error ?? null,
    order_ref: order.order_ref,
  });
  refresh();
  return eig.ok
    ? success(eigSuccessNote(eig))
    : failure(`ELECT-I push failed: ${eig.error ?? "unknown error"}`);
}
