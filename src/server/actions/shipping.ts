"use server";

/**
 * submitShipping: the post-payment "confirm your order + shipping details"
 * step. Reached from the tracking link emailed after the admin verifies the
 * payment. The 48-hex tracking token is the credential (as on the tracking
 * page); shipping details can only be added to a PAID order.
 */

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { supabaseService } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/settings";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendEmail } from "@/lib/email/brevo";
import { shippingReceivedAdminHtml, shippingReceivedAdminSubject } from "@/lib/email/templates";
import { shippingSubmitSchema } from "@/lib/validation";
import type { Order } from "@/lib/db-types";

export type SubmitShippingResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function submitShipping(input: unknown): Promise<SubmitShippingResult> {
  const parsed = shippingSubmitSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_form";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  const ip = clientIpFrom(await headers());
  if (!(await verifyTurnstile(data.turnstileToken, ip))) {
    return { ok: false, error: "Human verification failed. Please try again." };
  }
  if (!(await rateLimit(`shipping-ip:${ip}`, 20, 3600))) {
    return { ok: false, error: "Too many attempts. Please try again in a little while." };
  }

  const service = supabaseService();
  const { data: orderRow } = await service
    .from("orders")
    .select("*")
    .eq("tracking_token", data.token)
    .maybeSingle();
  const order = orderRow as Order | null;
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "paid") {
    return {
      ok: false,
      error:
        "Shipping details can be added once your payment is confirmed — we'll email you a link as soon as it is.",
    };
  }

  // Conditional on status = paid so a concurrent transition can't be overwritten.
  const { data: updated, error } = await service
    .from("orders")
    .update({
      phone: data.phone,
      governorate: data.governorate,
      address: data.address,
      company_name: data.companyName || null,
      tax_id: data.taxId || null,
      shipping_submitted_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .eq("status", "paid")
    .select("id");
  if (error) return { ok: false, error: `Could not save your details: ${error.message}` };
  if (!updated?.length) {
    return { ok: false, error: "This order can no longer be edited. Please contact us." };
  }

  // Remember the details on the customer's profile for next time (best-effort).
  const { error: profileError } = await service
    .from("customer_profiles")
    .update({
      phone: data.phone,
      governorate: data.governorate,
      address: data.address,
      company_name: data.companyName || null,
      tax_id: data.taxId || null,
    })
    .eq("user_id", order.customer_id);
  if (profileError) console.error("profile shipping sync failed:", profileError.message);

  // Notify the store owner that the order is ready to ship (best-effort).
  try {
    const settings = await getSiteSettings();
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
    const subject = shippingReceivedAdminSubject(order.order_ref);
    const emailResult = await sendEmail({
      to: settings.contact.email,
      toName: "HDML",
      subject,
      html: shippingReceivedAdminHtml({
        orderRef: order.order_ref,
        customerName: order.customer_name,
        phone: data.phone,
        governorate: data.governorate,
        address: data.address,
        companyName: data.companyName || "",
        taxId: data.taxId || "",
        adminUrl: `${siteUrl}/admin/orders/${order.id}`,
        contact: {
          phone: settings.contact.phone,
          email: settings.contact.email,
          whatsapp: settings.contact.whatsapp,
        },
      }),
    });
    const { error: eventError } = await service.from("email_events").insert({
      order_id: order.id,
      kind: "shipping_received",
      recipient: settings.contact.email,
      subject,
      status: emailResult.sent ? "sent" : "failed",
      error: emailResult.error ?? null,
      provider_message_id: emailResult.providerMessageId ?? null,
      attempts: 1,
      dedupe_key: null,
    });
    if (eventError) console.error("email_events insert failed:", eventError.message);
  } catch (e) {
    console.error("shipping admin notification failed:", e);
  }

  refresh();
  return { ok: true };
}
