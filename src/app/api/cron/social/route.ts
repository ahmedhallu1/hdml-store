/**
 * Social auto-poster cron. Runs on a schedule (Cloudflare cron / external
 * pinger) and is guarded by CRON_SECRET, passed either as `?key=` or the
 * `x-cron-secret` header.
 *
 * Two idempotent passes (driven purely by post status, so re-runs are safe):
 *   A. Review emails — for "queued" posts whose review window has opened,
 *      send the approve/reject email and move them to "pending_review".
 *   B. Publish — when the poster is enabled and Meta is configured, publish
 *      "approved" posts whose slot has arrived, then email the owner a receipt.
 *
 * Every post is wrapped in try/catch so one failure cannot stop the batch.
 */

import {
  getSocialConfig,
  listSocialPosts,
  updateSocialPost,
} from "@/lib/social/store";
import { metaConfigured } from "@/lib/social/meta";
import { publishSocialPost } from "@/lib/social/publish";
import { sendSocialReviewEmail, sendSocialResultEmail } from "@/lib/social/email";

export const dynamic = "force-dynamic";

const HOUR_MS = 3600000;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never run without a configured secret
  const key = new URL(req.url).searchParams.get("key") ?? req.headers.get("x-cron-secret");
  return key === secret;
}

async function handle(req: Request): Promise<Response> {
  if (!authorized(req)) {
    return new Response("unauthorized", { status: 401 });
  }

  const config = await getSocialConfig();
  const posts = await listSocialPosts();
  const now = Date.now();

  let reviewed = 0;
  let published = 0;
  let failed = 0;

  // --- Pass A: review emails ------------------------------------------------
  for (const post of posts) {
    if (post.status !== "queued") continue;
    const windowOpensAt = new Date(post.scheduledAt).getTime() - config.reviewLeadHours * HOUR_MS;
    if (windowOpensAt > now) continue;
    try {
      const { sent } = await sendSocialReviewEmail(post);
      if (sent) {
        await updateSocialPost(post.id, {
          status: "pending_review",
          reviewEmailSentAt: new Date().toISOString(),
        });
        reviewed++;
      }
    } catch (e) {
      console.error(`social cron: review email failed for ${post.id}:`, e);
    }
  }

  // --- Pass B: publish ------------------------------------------------------
  if (config.enabled && metaConfigured()) {
    for (const post of posts) {
      if (post.status !== "approved") continue;
      if (new Date(post.scheduledAt).getTime() > now) continue;
      try {
        const updated = await publishSocialPost(post);
        if (updated.status === "published") published++;
        else failed++;
        await sendSocialResultEmail(updated);
      } catch (e) {
        console.error(`social cron: publish failed for ${post.id}:`, e);
        failed++;
      }
    }
  }

  return Response.json({ reviewed, published, failed });
}

export async function GET(req: Request): Promise<Response> {
  return handle(req);
}

export async function POST(req: Request): Promise<Response> {
  return handle(req);
}
