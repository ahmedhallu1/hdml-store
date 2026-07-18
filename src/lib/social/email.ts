/**
 * Owner-facing emails for the social auto-poster:
 *   - sendSocialReviewEmail: an approve/reject request sent `reviewLeadHours`
 *     before a post's scheduled slot. The two buttons are public capability
 *     URLs carrying the post's reviewToken.
 *   - sendSocialResultEmail: a receipt after a post is (attempted to be)
 *     published, listing per-platform success/failure.
 *
 * Self-contained, email-client-safe HTML (nested tables, inline styles only,
 * teal #004754 header) modelled on src/lib/email/templates.ts. Never throws —
 * delivery must never break the cron batch.
 */

import "server-only";
import { sendEmail } from "@/lib/email/brevo";
import { getSiteSettings } from "@/lib/settings";
import { supabaseService } from "@/lib/supabase/server";
import { facebookCaption, instagramCaption } from "./tailor";
import { socialImageUrl } from "./store";
import { formatSlot } from "./slot";
import type { SocialPost, SocialPlatform } from "./types";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
const TEAL = "#004754";
const FONT = "font-family:Arial,Helvetica,sans-serif;";
/** Postgres unique_violation — a duplicate review-email dedupe key. */
const UNIQUE_VIOLATION = "23505";

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
};

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape then preserve line breaks for HTML display. */
function escapeMultiline(s: string): string {
  return escapeHtml(s).replace(/\r?\n/g, "<br>");
}

/** Gray canvas → 600px card with teal header, white body, gray footer. */
function layout(bodyHtml: string): string {
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
<td style="background-color:#ffffff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px;padding:28px 24px;${FONT}font-size:14px;line-height:22px;color:#111827;">
${bodyHtml}
</td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** Table-based button (works without images/CSS). */
function button(href: string, label: string, bg: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-block;margin:0 8px 8px 0;">
<tr><td style="background-color:${bg};border-radius:8px;">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 26px;${FONT}font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
</td></tr>
</table>`;
}

/** Bordered block showing one platform's tailored caption. */
function captionBlock(label: string, caption: string): string {
  return `<p style="margin:0 0 6px;${FONT}font-size:12px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">${escapeHtml(label)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
<tr><td style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:14px 16px;${FONT}font-size:13px;line-height:20px;color:#111827;">
${escapeMultiline(caption)}
</td></tr>
</table>`;
}

async function ownerEmail(): Promise<string> {
  const settings = await getSiteSettings();
  return settings.contact.email;
}

// ---------------------------------------------------------------------------
// Review email
// ---------------------------------------------------------------------------

export async function sendSocialReviewEmail(post: SocialPost): Promise<{ sent: boolean }> {
  try {
    const to = await ownerEmail();
    const slotLabel = formatSlot(post.scheduledAt);
    const subject = `HDML post — approve before it publishes ${slotLabel}`;

    const tailorInput = {
      coreCaption: post.coreCaption,
      hashtags: post.hashtags,
      link: post.link,
    };

    const imageUrl = socialImageUrl(post.imagePath);
    const imageHtml = imageUrl
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
<tr><td align="center">
<img src="${escapeHtml(imageUrl)}" alt="Post image preview" style="max-width:100%;height:auto;border-radius:8px;border:1px solid #e5e7eb;" />
</td></tr>
</table>`
      : "";

    const captionBlocks = post.platforms
      .map((p) =>
        p === "facebook"
          ? captionBlock("Facebook caption", facebookCaption(tailorInput))
          : captionBlock("Instagram caption", instagramCaption(tailorInput)),
      )
      .join("");

    const platformNames =
      post.platforms.map((p) => PLATFORM_LABEL[p]).join(" & ") || "no platforms selected";

    const approveUrl = `${SITE}/api/social/review?token=${post.reviewToken}&action=approve`;
    const rejectUrl = `${SITE}/api/social/review?token=${post.reviewToken}&action=reject`;

    const body =
      `<p style="margin:0 0 16px;">Hi,</p>` +
      `<p style="margin:0 0 16px;${FONT}font-size:14px;line-height:22px;color:#374151;">` +
      `A social post is scheduled to publish on <strong>${escapeHtml(platformNames)}</strong> at ` +
      `<strong>${escapeHtml(slotLabel)}</strong>. Please review it below.</p>` +
      imageHtml +
      captionBlocks +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 8px;">` +
      `<tr><td style="background-color:#ecfeff;border-left:4px solid ${TEAL};border-radius:0 6px 6px 0;padding:14px 16px;${FONT}font-size:13px;line-height:20px;color:#0f5561;">` +
      `<strong>This post will only publish after you approve it.</strong> It is scheduled to auto-publish at ` +
      `${escapeHtml(slotLabel)} once approved. If you do nothing, or you Reject it, it will not be published.` +
      `</td></tr></table>` +
      `<p style="margin:18px 0 4px;${FONT}font-size:14px;color:#111827;">` +
      button(approveUrl, "Approve & schedule", TEAL) +
      button(rejectUrl, "Reject", "#b91c1c") +
      `</p>`;

    const html = layout(body);
    const result = await sendEmail({ to, subject, html });

    // Best-effort audit row (order_id null), deduped per post.
    try {
      const service = supabaseService();
      const { error } = await service.from("email_events").insert({
        order_id: null,
        kind: "social_review",
        recipient: to,
        subject,
        status: result.sent ? "sent" : "failed",
        error: result.error ?? null,
        provider_message_id: result.providerMessageId ?? null,
        attempts: 1,
        dedupe_key: `social_review:${post.id}`,
      });
      if (error && error.code !== UNIQUE_VIOLATION) {
        console.error("social_review email_events insert failed:", error.message);
      }
    } catch (e) {
      console.error("social_review email_events insert threw:", e);
    }

    return { sent: result.sent };
  } catch (e) {
    console.error("sendSocialReviewEmail failed:", e instanceof Error ? e.message : String(e));
    return { sent: false };
  }
}

// ---------------------------------------------------------------------------
// Result email
// ---------------------------------------------------------------------------

export async function sendSocialResultEmail(post: SocialPost): Promise<{ sent: boolean }> {
  try {
    const to = await ownerEmail();
    const anyError = post.platforms.some((p) => post.results[p]?.error);
    const subject = anyError ? "HDML post failed to publish" : "HDML post published";

    const rows = post.platforms
      .map((p) => {
        const label = PLATFORM_LABEL[p];
        const r = post.results[p];
        if (r && r.postId && !r.error) {
          const link = r.permalink
            ? ` — <a href="${escapeHtml(r.permalink)}" style="color:${TEAL};word-break:break-all;">view post</a>`
            : "";
          return `<tr><td style="padding:8px 0;${FONT}font-size:13px;line-height:20px;color:#065f46;border-bottom:1px solid #f3f4f6;"><strong>${escapeHtml(label)}</strong>: published${link}</td></tr>`;
        }
        const errText = r?.error ? escapeHtml(r.error) : "unknown error";
        return `<tr><td style="padding:8px 0;${FONT}font-size:13px;line-height:20px;color:#991b1b;border-bottom:1px solid #f3f4f6;"><strong>${escapeHtml(label)}</strong>: failed — ${errText}</td></tr>`;
      })
      .join("");

    const headline = anyError
      ? `<p style="margin:0 0 16px;${FONT}font-size:14px;line-height:22px;color:#374151;">Your scheduled social post ran into a problem. Details below.</p>`
      : `<p style="margin:0 0 16px;${FONT}font-size:14px;line-height:22px;color:#374151;">Your scheduled social post is live. Details below.</p>`;

    const adminUrl = `${SITE}/admin/social`;
    const body =
      `<p style="margin:0 0 16px;">Hi,</p>` +
      headline +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">${rows}</table>` +
      `<p style="margin:0 0 4px;${FONT}font-size:13px;line-height:20px;color:#374151;">` +
      `Manage your posts any time at <a href="${escapeHtml(adminUrl)}" style="color:${TEAL};">${escapeHtml(adminUrl)}</a>.</p>`;

    const html = layout(body);
    const result = await sendEmail({ to, subject, html });
    return { sent: result.sent };
  } catch (e) {
    console.error("sendSocialResultEmail failed:", e instanceof Error ? e.message : String(e));
    return { sent: false };
  }
}
