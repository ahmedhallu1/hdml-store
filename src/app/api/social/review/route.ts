/**
 * Public approve/reject endpoint for scheduled social posts.
 *
 * The link is a capability URL: the post's `reviewToken` IS the authorization,
 * so this route requires NO login. It always returns a small branded HTML page
 * (never JSON) and is soft rate-limited per client IP.
 *
 *   GET /api/social/review?token=<reviewToken>&action=approve|reject
 */

import { rateLimit, clientIpFrom } from "@/lib/rate-limit";
import { getSocialPostByToken, updateSocialPost } from "@/lib/social/store";
import { formatSlot } from "@/lib/social/slot";
import { SOCIAL_STATUS_LABELS, type SocialPostStatus } from "@/lib/social/types";

export const dynamic = "force-dynamic";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
const TEAL = "#004754";
const FONT = "font-family:Arial,Helvetica,sans-serif;";

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A centered branded card page. `tone` tints the heading. */
function page(
  heading: string,
  message: string,
  tone: "ok" | "warn" | "bad" = "ok",
  status = 200,
): Response {
  const color = tone === "bad" ? "#b91c1c" : tone === "warn" ? "#92400e" : "#065f46";
  const home = SITE || "/";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${escapeHtml(heading)} — HDML</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;min-height:100vh;">
<tr><td align="center" style="padding:48px 16px;">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:480px;">
<tr>
<td style="background-color:${TEAL};border-radius:12px 12px 0 0;padding:20px 28px;${FONT}font-size:22px;font-weight:bold;letter-spacing:3px;color:#ffffff;">HDML</td>
</tr>
<tr>
<td style="background-color:#ffffff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:32px 28px;${FONT}color:#111827;">
<h1 style="margin:0 0 12px;${FONT}font-size:20px;color:${color};">${escapeHtml(heading)}</h1>
<p style="margin:0 0 24px;${FONT}font-size:14px;line-height:22px;color:#374151;">${escapeHtml(message)}</p>
<a href="${escapeHtml(home)}" style="display:inline-block;background-color:${TEAL};border-radius:8px;padding:11px 22px;${FONT}font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">Go to the store</a>
</td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const action = url.searchParams.get("action");

  const allowed = await rateLimit(`social-review:${clientIpFrom(req.headers)}`, 30, 3600);
  if (!allowed) {
    return page(
      "Too many requests",
      "You have opened this link too many times. Please wait a little while and try again.",
      "warn",
    );
  }

  const post = await getSocialPostByToken(token);
  if (!post) {
    return page(
      "Link not found",
      "This approval link is invalid or has expired. If you were reviewing a scheduled post, please check your latest review email.",
      "warn",
    );
  }

  const isPending = post.status === "queued" || post.status === "pending_review";
  if (isPending && (action === "approve" || action === "reject")) {
    const now = new Date().toISOString();
    if (action === "approve") {
      await updateSocialPost(post.id, { status: "approved", reviewedAt: now });
      return page(
        "Approved",
        `Approved — it will publish at ${formatSlot(post.scheduledAt)}. You can still change your mind before then from the admin dashboard.`,
        "ok",
      );
    }
    await updateSocialPost(post.id, { status: "rejected", reviewedAt: now });
    return page(
      "Rejected",
      "Rejected — it will not be published. No further action is needed.",
      "bad",
    );
  }

  if (isPending) {
    // Token + post are valid, but the action was missing or not recognized.
    return page(
      "Nothing to do",
      "This link did not carry a valid approve or reject action. Please use the buttons in your review email.",
      "warn",
    );
  }

  // Already approved / rejected / published / failed / cancelled.
  const label = SOCIAL_STATUS_LABELS[post.status as SocialPostStatus] ?? post.status;
  return page(
    "Already handled",
    `This post has already been handled (${label.toLowerCase()}), so this link no longer does anything.`,
    "warn",
  );
}
