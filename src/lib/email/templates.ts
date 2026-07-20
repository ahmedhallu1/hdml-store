/**
 * Transactional email templates for HDML.
 *
 * Email-client-safe HTML: nested tables, inline styles ONLY (no <style>
 * blocks, no flex/grid), max-width 600, teal #004754 header bar, white card
 * body, gray footer with contact details. Pure string builders — no server
 * dependencies — so they stay unit-testable; all dynamic values are passed
 * in by the caller (invoice-service) and HTML-escaped here.
 */

import type { InvoiceKind } from "@/lib/db-types";

export interface EmailContact {
  phone: string;
  email: string;
  whatsapp: string;
}

export interface OrderEmailArgs {
  kind: InvoiceKind;
  customerName: string;
  orderRef: string;
  statusLabel: string;
  totalLabel: string;
  paymentMethodLabel: string;
  items: Array<{ name: string; qty: number; amountLabel: string }>;
  trackingUrl: string;
  contact: EmailContact;
  deliveryMessage: string;
  /** Final email only: prompt the customer to confirm + add shipping details. */
  needsShipping?: boolean;
}

export interface ProofRejectedArgs {
  customerName: string;
  orderRef: string;
  reason?: string;
  trackingUrl: string;
  contact: EmailContact;
}

const TEAL = "#004754";
const FONT = "font-family:Arial,Helvetica,sans-serif;";
/** Item names rendered in the email are capped at this many rows. */
const MAX_ITEM_ROWS = 10;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Shared layout pieces
// ---------------------------------------------------------------------------

/** Full document scaffold: gray canvas → 600px card with header/body/footer. */
function layout(bodyHtml: string, contact: EmailContact): string {
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background-color:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr>
<td style="background-color:${TEAL};border-radius:8px 8px 0 0;padding:18px 24px;${FONT}font-size:22px;font-weight:bold;letter-spacing:3px;color:#ffffff;">HDML</td>
</tr>
<tr>
<td style="background-color:#ffffff;border:1px solid #e5e7eb;border-top:0;padding:28px 24px;${FONT}font-size:14px;line-height:22px;color:#111827;">
${bodyHtml}
</td>
</tr>
<tr>
<td style="background-color:#f9fafb;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px;padding:16px 24px;${FONT}font-size:12px;line-height:20px;color:#6b7280;">
HDML &mdash; Wholesale Electronics &amp; Accessories<br>
Phone: ${escapeHtml(contact.phone)} &nbsp;&bull;&nbsp; WhatsApp: ${escapeHtml(contact.whatsapp)}<br>
Email: <a href="mailto:${escapeHtml(contact.email)}" style="color:${TEAL};">${escapeHtml(contact.email)}</a>
</td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** Bulletproof-enough button (table-based, works without images/CSS). */
function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 8px;">
<tr><td style="background-color:${TEAL};border-radius:8px;">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;${FONT}font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
</td></tr>
</table>
<p style="margin:0 0 16px;${FONT}font-size:12px;line-height:18px;color:#6b7280;">Or open this link: <a href="${escapeHtml(href)}" style="color:${TEAL};word-break:break-all;">${escapeHtml(href)}</a></p>`;
}

/** Colored left-border callout box. */
function noticeBox(html: string, bg: string, border: string, color: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
<tr><td style="background-color:${bg};border-left:4px solid ${border};border-radius:0 6px 6px 0;padding:14px 16px;${FONT}font-size:13px;line-height:20px;color:${color};">
${html}
</td></tr>
</table>`;
}

/** Order meta rows (ref / status / payment method). */
function metaTable(rows: Array<[string, string]>): string {
  const trs = rows
    .map(
      ([k, v]) => `<tr>
<td style="padding:4px 12px 4px 0;${FONT}font-size:13px;color:#6b7280;white-space:nowrap;">${escapeHtml(k)}</td>
<td style="padding:4px 0;${FONT}font-size:13px;color:#111827;font-weight:bold;">${escapeHtml(v)}</td>
</tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">${trs}</table>`;
}

/** Items table capped at MAX_ITEM_ROWS with an "…and N more" row + total. */
function itemsTable(
  items: OrderEmailArgs["items"],
  totalLabel: string,
): string {
  const shown = items.slice(0, MAX_ITEM_ROWS);
  const remaining = items.length - shown.length;
  const cell = `padding:8px 0;${FONT}font-size:13px;line-height:19px;color:#111827;border-bottom:1px solid #f3f4f6;`;
  const rows = shown
    .map(
      (i) => `<tr>
<td style="${cell}">${escapeHtml(i.name)}</td>
<td align="center" style="${cell}color:#6b7280;">&times;${i.qty}</td>
<td align="right" style="${cell}white-space:nowrap;">${escapeHtml(i.amountLabel)}</td>
</tr>`,
    )
    .join("");
  const moreRow =
    remaining > 0
      ? `<tr><td colspan="3" style="padding:8px 0;${FONT}font-size:13px;color:#6b7280;border-bottom:1px solid #f3f4f6;">&hellip;and ${remaining} more item${remaining === 1 ? "" : "s"}</td></tr>`
      : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
<tr>
<th align="left" style="padding:0 0 6px;${FONT}font-size:12px;color:#6b7280;border-bottom:2px solid ${TEAL};">Item</th>
<th align="center" style="padding:0 0 6px;${FONT}font-size:12px;color:#6b7280;border-bottom:2px solid ${TEAL};">Qty</th>
<th align="right" style="padding:0 0 6px;${FONT}font-size:12px;color:#6b7280;border-bottom:2px solid ${TEAL};">Amount</th>
</tr>
${rows}
${moreRow}
<tr>
<td colspan="2" style="padding:10px 0 0;${FONT}font-size:14px;font-weight:bold;color:#111827;">Total</td>
<td align="right" style="padding:10px 0 0;${FONT}font-size:14px;font-weight:bold;color:${TEAL};white-space:nowrap;">${escapeHtml(totalLabel)}</td>
</tr>
</table>`;
}

// ---------------------------------------------------------------------------
// Order emails (preliminary / final)
// ---------------------------------------------------------------------------

export function orderEmailSubject(
  kind: InvoiceKind,
  orderRef: string,
  needsShipping = false,
): string {
  if (kind === "preliminary") {
    return `HDML Order ${orderRef} — received, payment pending verification`;
  }
  return needsShipping
    ? `HDML Order ${orderRef} — payment confirmed ✔ Confirm your order & shipping`
    : `HDML Order ${orderRef} — payment confirmed ✔`;
}

export function orderEmailHtml(args: OrderEmailArgs): string {
  const {
    kind,
    customerName,
    orderRef,
    statusLabel,
    totalLabel,
    paymentMethodLabel,
    items,
    trackingUrl,
    contact,
    deliveryMessage,
    needsShipping,
  } = args;

  const finalNeedsShipping = kind === "final" && needsShipping;

  const notice =
    kind === "preliminary"
      ? noticeBox(
          `<strong>Payment pending verification.</strong> We received your order and your payment proof. ` +
            `Your payment is being <strong>verified manually</strong> by our team and is <strong>NOT confirmed yet</strong>. ` +
            `We will email you again as soon as the verification is complete.`,
          "#fef3c7",
          "#f59e0b",
          "#92400e",
        )
      : noticeBox(
          `<strong>Payment confirmed.</strong> Your payment for order ${escapeHtml(orderRef)} has been verified. ` +
            `Thank you for your business!`,
          "#ecfdf5",
          "#047857",
          "#065f46",
        );

  // After payment, the customer's final step is to confirm the order and add
  // their shipping details on the tracking page.
  const shippingCta = finalNeedsShipping
    ? noticeBox(
        `<strong>One last step — confirm your order.</strong> Please click the button below to ` +
          `confirm your order and enter your <strong>shipping details</strong> so we can arrange ` +
          `delivery. Your order is only finalized once we have them.`,
        "#eff6ff",
        "#2563eb",
        "#1e3a8a",
      )
    : "";

  const ctaLabel = finalNeedsShipping
    ? "Confirm your order & add shipping details"
    : kind === "final"
      ? "View your order"
      : "Track your order";

  const deliveryLine = finalNeedsShipping
    ? ""
    : `<p style="margin:0 0 4px;${FONT}font-size:13px;line-height:20px;color:#374151;">
<strong>Delivery:</strong> ${escapeHtml(deliveryMessage)}
</p>`;

  const body = `
<p style="margin:0 0 16px;">Hi ${escapeHtml(customerName)},</p>
${notice}
${shippingCta}
<h2 style="margin:0 0 12px;${FONT}font-size:16px;color:${TEAL};">Order summary</h2>
${metaTable([
  ["Order ID", orderRef],
  ["Status", statusLabel],
  ["Payment method", paymentMethodLabel],
])}
${itemsTable(items, totalLabel)}
<p style="margin:0 0 16px;${FONT}font-size:13px;line-height:20px;color:#374151;">
Your ${kind === "preliminary" ? "preliminary receipt" : "receipt"} is attached to this email as a PDF.
</p>
${deliveryLine}
${button(trackingUrl, ctaLabel)}
`;

  return layout(body, contact);
}

// ---------------------------------------------------------------------------
// Payment proof rejected
// ---------------------------------------------------------------------------

export function proofRejectedSubject(orderRef: string): string {
  return `HDML Order ${orderRef} — payment proof rejected, action needed`;
}

export function proofRejectedHtml(args: ProofRejectedArgs): string {
  const { customerName, orderRef, reason, trackingUrl, contact } = args;

  const reasonHtml = reason
    ? `<p style="margin:12px 0 0;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>`
    : "";

  const body = `
<p style="margin:0 0 16px;">Hi ${escapeHtml(customerName)},</p>
${noticeBox(
  `<strong>We could not verify your payment proof.</strong> The payment screenshot you uploaded for order ` +
    `<strong>${escapeHtml(orderRef)}</strong> was reviewed and unfortunately could not be accepted.${reasonHtml}`,
  "#fef2f2",
  "#dc2626",
  "#991b1b",
)}
<p style="margin:0 0 16px;${FONT}font-size:13px;line-height:20px;color:#374151;">
No payment has been confirmed for this order yet. Please upload a new, clear screenshot of your
transfer from your order tracking page — make sure the amount, date and reference are visible.
If you believe this is a mistake, just reply to this email or contact us using the details below
and we will sort it out.
</p>
${button(trackingUrl, "Upload a new payment proof")}
`;

  return layout(body, contact);
}

// ---------------------------------------------------------------------------
// Shipping details submitted — internal notice to the store owner
// ---------------------------------------------------------------------------

export function shippingReceivedAdminSubject(orderRef: string): string {
  return `HDML Order ${orderRef} — shipping details submitted (ready to fulfill)`;
}

export function shippingReceivedAdminHtml(args: {
  orderRef: string;
  customerName: string;
  phone: string;
  governorate: string;
  address: string;
  companyName?: string;
  taxId?: string;
  adminUrl: string;
  contact: EmailContact;
}): string {
  const rows: Array<[string, string]> = [
    ["Order", args.orderRef],
    ["Customer", args.customerName],
    ["Phone", args.phone],
    ["Governorate", args.governorate],
  ];
  if (args.companyName) rows.push(["Company", args.companyName]);
  if (args.taxId) rows.push(["Tax ID", args.taxId]);

  const body = `
<p style="margin:0 0 16px;">Hi,</p>
${noticeBox(
  `<strong>Order confirmed by the customer.</strong> They have submitted their shipping details for order ` +
    `<strong>${escapeHtml(args.orderRef)}</strong>. It is ready to fulfill.`,
  "#ecfdf5",
  "#047857",
  "#065f46",
)}
${metaTable(rows)}
<p style="margin:0 0 4px;${FONT}font-size:13px;line-height:20px;color:#374151;"><strong>Delivery address</strong></p>
<p style="margin:0 0 16px;${FONT}font-size:13px;line-height:20px;color:#111827;">${escapeHtml(args.address)}</p>
${button(args.adminUrl, "Open the order in admin")}
`;

  return layout(body, args.contact);
}

// ---------------------------------------------------------------------------
// Welcome email (sent once, on registration)
// ---------------------------------------------------------------------------

export function welcomeEmailSubject(): string {
  return "Welcome to HDML — your wholesale account is ready";
}

export function welcomeEmailHtml(args: {
  customerName: string;
  catalogUrl: string;
  contact: EmailContact;
}): string {
  const { customerName, catalogUrl, contact } = args;

  const body = `
<p style="margin:0 0 16px;">Hi ${escapeHtml(customerName)},</p>
<p style="margin:0 0 16px;${FONT}font-size:14px;line-height:22px;color:#374151;">
Your HDML wholesale account is ready — welcome aboard! You can now browse our full catalog of
around <strong>9,000 wholesale products</strong> and place bulk orders straight from your account.
</p>
<p style="margin:0 0 16px;${FONT}font-size:14px;line-height:22px;color:#374151;">
Pay easily by <strong>Instapay or mobile wallet</strong>, upload your transfer, and track every
order online from start to delivery.
</p>
${noticeBox(
  `<strong>Order minimum:</strong> orders start at <strong>EGP 1,000</strong>. ` +
    `Add the items you need and check out whenever you are ready.`,
  "#ecfeff",
  "#004754",
  "#0f5561",
)}
${button(catalogUrl, "Browse the catalog")}
`;

  return layout(body, contact);
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export function passwordResetSubject(): string {
  return "Reset your HDML password";
}

export function passwordResetHtml(args: {
  customerName?: string;
  resetUrl: string;
  contact: EmailContact;
}): string {
  const { customerName, resetUrl, contact } = args;
  const greeting = customerName ? `Hi ${escapeHtml(customerName)},` : "Hi there,";

  const body = `
<p style="margin:0 0 16px;">${greeting}</p>
<p style="margin:0 0 16px;${FONT}font-size:14px;line-height:22px;color:#374151;">
Someone (hopefully you) asked to reset the password for your HDML account. Click the button below
to set a new password.
</p>
${button(resetUrl, "Set a new password")}
${noticeBox(
  `For your security, this link will <strong>expire soon</strong>. ` +
    `If you did not request a password reset, you can safely ignore this email — your password will not change.`,
  "#fef3c7",
  "#f59e0b",
  "#92400e",
)}
`;

  return layout(body, contact);
}
