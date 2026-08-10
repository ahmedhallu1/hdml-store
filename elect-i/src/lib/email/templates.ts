/**
 * ELECT-I Global transactional email templates.
 *
 * Table-based HTML for broad client support, obsidian/cyan brand, and every
 * dynamic value HTML-escaped. Copy is bilingual (en/zh) selected by `lang`.
 */

import { company } from "@/config/company";
import type { Locale } from "@/i18n/config";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ACCENT = "#17c8d2";
const INK = "#0c121b";
const FONT =
  "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

function shell(bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f8;padding:24px 0;${FONT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:92%;">
<tr><td style="background:${INK};border-radius:12px 12px 0 0;padding:22px 28px;${FONT}font-size:20px;font-weight:800;letter-spacing:0.5px;color:#ffffff;">
ELECT&#8209;I <span style="color:${ACCENT};">Global</span>
</td></tr>
<tr><td style="background:#ffffff;padding:30px 28px;${FONT}font-size:15px;line-height:24px;color:#1f2937;">
${bodyHtml}
</td></tr>
<tr><td style="background:#f9fafb;border:1px solid #eef0f2;border-top:0;border-radius:0 0 12px 12px;padding:18px 28px;${FONT}font-size:12px;line-height:19px;color:#8a94a3;">
${esc(company.operator.disclosure)}<br><br>
${esc(company.slogan)} &nbsp;·&nbsp; <a href="https://${company.domain}" style="color:${ACCENT};text-decoration:none;">${company.domain}</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;"><tr>
<td style="background:${ACCENT};border-radius:10px;">
<a href="${esc(href)}" style="display:inline-block;padding:13px 26px;${FONT}font-size:15px;font-weight:700;color:${INK};text-decoration:none;">${esc(label)}</a>
</td></tr></table>`;
}

/* ── Welcome ─────────────────────────────────────────────────────────────── */

export function welcomeEmail(name: string, lang: Locale, catalogUrl: string): {
  subject: string;
  html: string;
} {
  const first = name.trim().split(/\s+/)[0] || name;
  if (lang === "zh") {
    return {
      subject: "欢迎加入 ELECT-I Global",
      html: shell(
        `<p style="margin:0 0 14px;">${esc(first)}，您好：</p>
<p style="margin:0 0 14px;">感谢您注册 <strong>ELECT-I Global</strong>——面向电子产品与一般商品的 B2B 批发平台。您的账户已开通，登录后即可查看批发价格、提交报价请求并管理订单。</p>
${button(catalogUrl, "浏览产品目录")}
<p style="margin:0;color:#6b7280;font-size:13px;">如果这不是您本人操作，请忽略此邮件。</p>`,
      ),
    };
  }
  return {
    subject: "Welcome to ELECT-I Global",
    html: shell(
      `<p style="margin:0 0 14px;">Hi ${esc(first)},</p>
<p style="margin:0 0 14px;">Thanks for creating an account on <strong>ELECT-I Global</strong>, the B2B wholesale platform for electronics and general merchandise. Your account is active — sign in any time to see wholesale pricing, request quotations and manage orders.</p>
${button(catalogUrl, "Browse the catalog")}
<p style="margin:0;color:#6b7280;font-size:13px;">If you didn't create this account, you can ignore this email.</p>`,
    ),
  };
}

/* ── Prepaid claim link (to the buyer) ───────────────────────────────────── */

export function claimLinkEmail(args: {
  lang: Locale;
  claimUrl: string;
  orderNumber: string;
  externalRef: string;
  merchantName: string | null;
}): { subject: string; html: string } {
  const { lang, claimUrl, orderNumber, externalRef, merchantName } = args;
  const by = merchantName ? merchantName : lang === "zh" ? "商户" : "the merchant";

  if (lang === "zh") {
    return {
      subject: `您的订单已预付 · 请填写收货信息（${orderNumber}）`,
      html: shell(
        `<p style="margin:0 0 14px;">您好：</p>
<p style="margin:0 0 14px;"><strong>${esc(by)}</strong> 已为您预付了一笔订单，费用已全部结清——<strong>应付金额为 $0.00</strong>。只需填写收货信息即可安排发货。</p>
<p style="margin:0 0 14px;">打开下方链接时，请输入您的原订单编号 <strong style="font-family:monospace;">${esc(externalRef)}</strong> 以验证身份。</p>
${button(claimUrl, "确认收货信息")}
<p style="margin:0 0 6px;color:#6b7280;font-size:13px;">订单号：<span style="font-family:monospace;">${esc(orderNumber)}</span></p>
<p style="margin:0;color:#6b7280;font-size:13px;">价格不含目的地清关费用与进口关税。</p>`,
      ),
    };
  }
  return {
    subject: `Your order is prepaid — confirm delivery (${orderNumber})`,
    html: shell(
      `<p style="margin:0 0 14px;">Hello,</p>
<p style="margin:0 0 14px;"><strong>${esc(by)}</strong> has prepaid an order for you — it's paid in full, so <strong>the amount due is $0.00</strong>. Just enter your delivery details and it ships.</p>
<p style="margin:0 0 14px;">When you open the link, you'll enter your original order reference <strong style="font-family:monospace;">${esc(externalRef)}</strong> to verify it's you.</p>
${button(claimUrl, "Confirm delivery details")}
<p style="margin:0 0 6px;color:#6b7280;font-size:13px;">Order number: <span style="font-family:monospace;">${esc(orderNumber)}</span></p>
<p style="margin:0;color:#6b7280;font-size:13px;">Prices exclude customs clearance and import duties at the destination.</p>`,
    ),
  };
}

/* ── Claim confirmed (to the buyer, after they submit the form) ──────────── */

/**
 * The one email the buyer gets AFTER handing over their address. It has to
 * answer the two questions they will otherwise write in and ask — when does it
 * arrive, and is anything else payable — so the lead time and the customs
 * exclusion are stated here in the same terms as /shipping, not softened.
 */
export function claimConfirmedEmail(args: {
  lang: Locale;
  orderNumber: string;
  externalRef: string;
  recipientName: string;
  destination: string;
}): { subject: string; html: string } {
  const { lang, orderNumber, externalRef, recipientName, destination } = args;
  const first = recipientName.trim().split(/\s+/)[0] || recipientName;

  if (lang === "zh") {
    return {
      subject: `订单已确认 · 正在安排发货（${orderNumber}）`,
      html: shell(
        `<p style="margin:0 0 14px;">${esc(first)}，您好：</p>
<p style="margin:0 0 14px;">您的订单已确认，收货信息已记录，订单已进入发货队列。此订单已全额预付，<strong>无需再支付任何货款</strong>。</p>
<p style="margin:0 0 14px;">由快递或货运代理配送至 <strong>${esc(destination)}</strong>，发货后通常 15–30 天送达。这是我们常见的时间范围，仅为预估，并非保证送达日期。</p>
<p style="margin:0 0 14px;">货物出库后，我们会立即将运单号发送到您的邮箱，后续的物流状态更新也会一并通知您。</p>
<p style="margin:0 0 14px;padding:12px 14px;background:#f9fafb;border-left:3px solid ${ACCENT};">价格不含目的地的清关费用与进口关税。除非报价单明确标注 DDP，收货人即为进口方，需自行承担清关、关税、进口税费及当地相关费用。</p>
<p style="margin:0 0 6px;color:#6b7280;font-size:13px;">订单号：<span style="font-family:monospace;">${esc(orderNumber)}</span></p>
<p style="margin:0;color:#6b7280;font-size:13px;">原订单编号：<span style="font-family:monospace;">${esc(externalRef)}</span></p>`,
      ),
    };
  }
  return {
    subject: `Order confirmed — we're arranging dispatch (${orderNumber})`,
    html: shell(
      `<p style="margin:0 0 14px;">Hi ${esc(first)},</p>
<p style="margin:0 0 14px;">Your order is confirmed and your delivery details are recorded. It's queued for shipping, and it was prepaid in full — <strong>there is nothing further to pay for the goods</strong>.</p>
<p style="margin:0 0 14px;">Delivery to <strong>${esc(destination)}</strong> is carried out by a courier or a freight forwarder appointed for the shipment, typically 15 to 30 days after dispatch. That range is what we normally see; it is an estimate, not a guaranteed date.</p>
<p style="margin:0 0 14px;">We'll email you tracking as soon as it leaves the warehouse, and keep you updated as it moves.</p>
<p style="margin:0 0 14px;padding:12px 14px;background:#f9fafb;border-left:3px solid ${ACCENT};">Prices exclude customs clearance and import duties at the destination. Unless a quotation explicitly states DDP, you are the importer of record and are responsible for clearance, duties, import taxes and any local charges.</p>
<p style="margin:0 0 6px;color:#6b7280;font-size:13px;">Order number: <span style="font-family:monospace;">${esc(orderNumber)}</span></p>
<p style="margin:0;color:#6b7280;font-size:13px;">Your original order reference: <span style="font-family:monospace;">${esc(externalRef)}</span></p>`,
    ),
  };
}
