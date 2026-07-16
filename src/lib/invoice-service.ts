/**
 * Invoice orchestration: generate receipt PDFs, store them in the private
 * `invoices` bucket, and send transactional order emails with the PDF
 * attached (deduped via email_events.dedupe_key).
 *
 * ⚠️ AUTHORIZATION CONTRACT: this module uses `supabaseService()` which
 * BYPASSES RLS. Callers are responsible for authorization BEFORE calling
 * anything here — e.g. `requireAdmin()` in admin actions, ownership /
 * tracking-token checks in customer flows. Nothing in this file checks who
 * is asking.
 */

import "server-only";
import { supabaseService } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/settings";
import { receiptDate } from "@/lib/order-ref";
import { formatEgp, toPiasters } from "@/lib/money";
import { generateReceiptPdf, type ReceiptData } from "@/lib/pdf/receipt";
import { sendEmail } from "@/lib/email/brevo";
import { orderEmailHtml, orderEmailSubject } from "@/lib/email/templates";
import {
  ORDER_STATUS_LABELS,
  type EmailEvent,
  type EmailStatus,
  type InvoiceKind,
  type Order,
  type OrderItem,
} from "@/lib/db-types";

// Re-exported so consumers can use the contract's names from this module.
export { generateReceiptPdf, type ReceiptData } from "@/lib/pdf/receipt";

const INVOICES_BUCKET = "invoices";
const SIGNED_URL_TTL_SECONDS = 600;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function loadOrderBundle(
  orderId: string,
): Promise<{ order: Order; items: OrderItem[] }> {
  const service = supabaseService();

  const { data: order, error: orderError } = await service
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();
  if (orderError || !order) {
    throw new Error(`Order ${orderId} not found: ${orderError?.message ?? "no row"}`);
  }

  const { data: items, error: itemsError } = await service
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (itemsError) {
    throw new Error(`Order items load failed for ${orderId}: ${itemsError.message}`);
  }

  return { order: order as Order, items: (items ?? []) as OrderItem[] };
}

/**
 * Generate the receipt PDF, upload it to storage (upsert) and upsert the
 * invoices row. Returns the fresh bytes so email sending never needs a
 * round-trip back to storage.
 */
async function buildAndStoreInvoice(
  orderId: string,
  kind: InvoiceKind,
): Promise<{ pdfPath: string; bytes: Uint8Array; order: Order; items: OrderItem[] }> {
  const service = supabaseService();
  const [{ order, items }, settings] = await Promise.all([
    loadOrderBundle(orderId),
    getSiteSettings(),
  ]);

  const receipt: ReceiptData = {
    orderRef: order.order_ref,
    dateLabel: receiptDate(new Date(order.created_at)),
    paymentMethodLabel: order.payment_method_label || "Manual payment",
    customerName: order.customer_name,
    customerPhone: order.phone,
    seller: {
      name: settings.seller_info.name,
      taxId: settings.seller_info.tax_id,
      address: settings.seller_info.address,
    },
    items: items.map((i) => ({
      description: i.name_snapshot,
      qty: i.qty,
      // numeric(12,2) arrives as a JS number — stringify before parsing.
      unitPricePiasters: toPiasters(String(i.unit_price)),
      amountPiasters: toPiasters(String(i.amount)),
    })),
    totalQty: items.reduce((sum, i) => sum + i.qty, 0),
    totalPiasters: toPiasters(String(order.total)),
    deliveryMessage: settings.delivery.message,
    kind,
  };

  const bytes = await generateReceiptPdf(receipt);

  const pdfPath = `orders/${orderId}/${kind}-${order.order_ref}.pdf`;
  const { error: uploadError } = await service.storage
    .from(INVOICES_BUCKET)
    .upload(pdfPath, bytes, { upsert: true, contentType: "application/pdf" });
  if (uploadError) {
    throw new Error(`Invoice upload failed for ${orderId}/${kind}: ${uploadError.message}`);
  }

  const { error: rowError } = await service.from("invoices").upsert(
    {
      order_id: orderId,
      kind,
      pdf_path: pdfPath,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "order_id,kind" },
  );
  if (rowError) {
    throw new Error(`Invoice row upsert failed for ${orderId}/${kind}: ${rowError.message}`);
  }

  return { pdfPath, bytes, order, items };
}

/** Insert or update the email_events row for a dedupe key (best-effort). */
async function recordEmailEvent(
  existing: EmailEvent | null,
  fields: {
    orderId: string;
    kind: string;
    dedupeKey: string;
    recipient: string;
    subject: string;
    status: EmailStatus;
    error: string | null;
    providerMessageId: string | null;
  },
): Promise<void> {
  const service = supabaseService();
  if (existing) {
    const { error } = await service
      .from("email_events")
      .update({
        recipient: fields.recipient || existing.recipient,
        subject: fields.subject || existing.subject,
        status: fields.status,
        error: fields.error,
        provider_message_id: fields.providerMessageId,
        attempts: existing.attempts + 1,
      })
      .eq("id", existing.id);
    if (error) console.error("email_events update failed:", error.message);
  } else {
    const { error } = await service.from("email_events").insert({
      order_id: fields.orderId,
      kind: fields.kind,
      recipient: fields.recipient || "unknown",
      subject: fields.subject || null,
      status: fields.status,
      error: fields.error,
      provider_message_id: fields.providerMessageId,
      attempts: 1,
      dedupe_key: fields.dedupeKey,
    });
    if (error) console.error("email_events insert failed:", error.message);
  }
}

/** Uint8Array → base64 (attachment payload for Brevo). */
function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

// ---------------------------------------------------------------------------
// Public API (contract used by checkout / proof / admin modules)
// ---------------------------------------------------------------------------

/**
 * Ensure the invoice PDF for (orderId, kind) exists in storage and in the
 * invoices table. Always regenerates from the current order snapshot, so
 * admin edits (custom lines, adjustments) are reflected on re-issue.
 */
export async function ensureInvoice(
  orderId: string,
  kind: InvoiceKind,
): Promise<{ pdfPath: string }> {
  const { pdfPath } = await buildAndStoreInvoice(orderId, kind);
  return { pdfPath };
}

/**
 * Send the preliminary/final order email with the receipt PDF attached.
 *
 * Dedupe: key `order:{orderId}:{kind}` — if a prior attempt already has
 * status "sent" and `opts.force` is not set, returns `{sent:true, deduped:true}`
 * without re-sending. Failed attempts are retried (attempts++).
 *
 * Never throws on email failure — returns `{ sent: false, error }`.
 */
export async function sendOrderEmail(
  orderId: string,
  kind: InvoiceKind,
  opts?: { force?: boolean },
): Promise<{ sent: boolean; deduped?: boolean; error?: string }> {
  const service = supabaseService();
  const dedupeKey = `order:${orderId}:${kind}`;

  const { data: existingRow } = await service
    .from("email_events")
    .select("*")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  const existing = (existingRow ?? null) as EmailEvent | null;

  if (existing?.status === "sent" && !opts?.force) {
    return { sent: true, deduped: true };
  }

  let recipient = "";
  let subject = "";
  try {
    // Generate (or regenerate) the PDF and keep the bytes for the attachment.
    const { bytes, order, items } = await buildAndStoreInvoice(orderId, kind);
    recipient = order.email;
    subject = orderEmailSubject(kind, order.order_ref);

    const settings = await getSiteSettings();
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
    const trackingUrl = `${siteUrl}/order/${order.tracking_token}`;

    const html = orderEmailHtml({
      kind,
      customerName: order.customer_name,
      orderRef: order.order_ref,
      statusLabel: ORDER_STATUS_LABELS[order.status],
      totalLabel: formatEgp(toPiasters(String(order.total))),
      paymentMethodLabel: order.payment_method_label || "Manual payment",
      items: items.map((i) => ({
        name: i.name_snapshot,
        qty: i.qty,
        amountLabel: formatEgp(toPiasters(String(i.amount))),
      })),
      trackingUrl,
      contact: {
        phone: settings.contact.phone,
        email: settings.contact.email,
        whatsapp: settings.contact.whatsapp,
      },
      deliveryMessage: settings.delivery.message,
    });

    const result = await sendEmail({
      to: order.email,
      toName: order.customer_name,
      subject,
      html,
      attachments: [{ name: `${order.order_ref}.pdf`, contentBase64: toBase64(bytes) }],
    });

    await recordEmailEvent(existing, {
      orderId,
      kind: `order_${kind}`,
      dedupeKey,
      recipient,
      subject,
      status: result.sent ? "sent" : "failed",
      error: result.error ?? null,
      providerMessageId: result.providerMessageId ?? null,
    });

    return result.sent ? { sent: true } : { sent: false, error: result.error ?? "send failed" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Best-effort failure record; never let bookkeeping mask the real error.
    try {
      await recordEmailEvent(existing, {
        orderId,
        kind: `order_${kind}`,
        dedupeKey,
        recipient,
        subject,
        status: "failed",
        error: message,
        providerMessageId: null,
      });
    } catch {
      // ignore
    }
    return { sent: false, error: message };
  }
}

/**
 * Short-lived signed URL (10 min) for an existing invoice PDF, or null when
 * the invoice has not been generated yet.
 */
export async function getInvoiceSignedUrl(
  orderId: string,
  kind: InvoiceKind,
): Promise<string | null> {
  const service = supabaseService();

  const { data: row } = await service
    .from("invoices")
    .select("pdf_path")
    .eq("order_id", orderId)
    .eq("kind", kind)
    .maybeSingle();
  const pdfPath = (row as { pdf_path?: string } | null)?.pdf_path;
  if (!pdfPath) return null;

  const { data, error } = await service.storage
    .from(INVOICES_BUCKET)
    .createSignedUrl(pdfPath, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error(`Signed URL failed for ${pdfPath}:`, error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/** Email history for an order (admin order detail UI), newest first. */
export async function getOrderEmailEvents(orderId: string): Promise<EmailEvent[]> {
  const service = supabaseService();
  const { data, error } = await service
    .from("email_events")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error(`email_events load failed for ${orderId}:`, error.message);
    return [];
  }
  return (data ?? []) as EmailEvent[];
}
