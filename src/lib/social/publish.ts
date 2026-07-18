/**
 * Publishes an approved social post to its target platforms.
 *
 * Server-only. Every platform call is wrapped so one failure is captured as a
 * per-platform error rather than aborting the whole post; the function never
 * throws. The post is marked "published" only when every requested platform
 * returned a postId with no error, otherwise "failed" (partial results kept).
 */

import "server-only";
import { getSocialConfig, socialImageUrl, updateSocialPost } from "./store";
import { facebookCaption, instagramCaption } from "./tailor";
import { publishToFacebook, publishToInstagram } from "./meta";
import type {
  SocialPost,
  SocialPlatform,
  SocialPostResult,
  SocialPostStatus,
} from "./types";

export async function publishSocialPost(post: SocialPost): Promise<SocialPost> {
  const config = await getSocialConfig();
  const imageUrl = socialImageUrl(post.imagePath);
  const tailorInput = {
    coreCaption: post.coreCaption,
    hashtags: post.hashtags,
    link: post.link,
  };

  const results: Partial<Record<SocialPlatform, SocialPostResult>> = {};

  for (const platform of post.platforms) {
    try {
      if (platform === "facebook") {
        const caption = facebookCaption(tailorInput);
        results.facebook = await publishToFacebook(config.fbPageId, imageUrl, caption);
      } else if (platform === "instagram") {
        const caption = instagramCaption(tailorInput);
        results.instagram = await publishToInstagram(config.igUserId, imageUrl, caption);
      }
    } catch (e) {
      // Defensive: the meta client is documented never-throw, but a bug here
      // must not sink the other platform or the status bookkeeping.
      results[platform] = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  // Published only if every requested platform succeeded (postId, no error).
  const allSucceeded =
    post.platforms.length > 0 &&
    post.platforms.every((p) => {
      const r = results[p];
      return Boolean(r && r.postId && !r.error);
    });

  const status: SocialPostStatus = allSucceeded ? "published" : "failed";
  const publishedAt = new Date().toISOString();

  const updated = await updateSocialPost(post.id, { status, results, publishedAt });
  return updated ?? { ...post, status, results, publishedAt };
}
