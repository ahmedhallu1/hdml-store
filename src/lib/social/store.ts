/**
 * Persistence for the social auto-poster, layered on the existing
 * `site_settings` table (no new migration required):
 *   - key `social_config`         → the SocialConfig JSON.
 *   - key `social_post:<uuid>`    → one SocialPost JSON per post (isolated
 *     rows, so the cron and admin never race on a shared array).
 *
 * Server-only + service role. Callers must authorize first (requireAdmin for
 * admin actions; capability token for the public review route).
 */

import "server-only";
import { randomUUID, randomBytes } from "node:crypto";
import { supabaseService } from "@/lib/supabase/server";
import { nextSlotAfter } from "./slot";
import {
  DEFAULT_SOCIAL_CONFIG,
  type SocialConfig,
  type SocialPost,
  type SocialPlatform,
} from "./types";

const CONFIG_KEY = "social_config";
const POST_PREFIX = "social_post:";

export async function getSocialConfig(): Promise<SocialConfig> {
  const service = supabaseService();
  const { data } = await service.from("site_settings").select("value").eq("key", CONFIG_KEY).maybeSingle();
  const stored = (data?.value ?? {}) as Partial<SocialConfig>;
  return {
    ...DEFAULT_SOCIAL_CONFIG,
    ...stored,
    weeklySlot: { ...DEFAULT_SOCIAL_CONFIG.weeklySlot, ...(stored.weeklySlot ?? {}) },
    platforms: { ...DEFAULT_SOCIAL_CONFIG.platforms, ...(stored.platforms ?? {}) },
  };
}

export async function saveSocialConfig(config: SocialConfig): Promise<void> {
  const service = supabaseService();
  const { error } = await service
    .from("site_settings")
    .upsert({ key: CONFIG_KEY, value: config as never }, { onConflict: "key" });
  if (error) throw new Error(`Failed to save social config: ${error.message}`);
}

export async function listSocialPosts(): Promise<SocialPost[]> {
  const service = supabaseService();
  const { data, error } = await service
    .from("site_settings")
    .select("value")
    .like("key", `${POST_PREFIX}%`);
  if (error) {
    console.error("listSocialPosts failed:", error.message);
    return [];
  }
  return (data ?? [])
    .map((r) => r.value as SocialPost)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export async function getSocialPost(id: string): Promise<SocialPost | null> {
  const service = supabaseService();
  const { data } = await service
    .from("site_settings")
    .select("value")
    .eq("key", `${POST_PREFIX}${id}`)
    .maybeSingle();
  return (data?.value as SocialPost) ?? null;
}

export async function getSocialPostByToken(reviewToken: string): Promise<SocialPost | null> {
  if (!reviewToken) return null;
  const posts = await listSocialPosts();
  return posts.find((p) => p.reviewToken === reviewToken) ?? null;
}

/** Slots already claimed by posts that are still in the pipeline. */
function activeSlots(posts: SocialPost[]): number[] {
  const live = new Set(["queued", "pending_review", "approved"]);
  return posts.filter((p) => live.has(p.status)).map((p) => new Date(p.scheduledAt).getTime());
}

export interface CreateSocialPostInput {
  coreCaption: string;
  hashtags: string;
  link: string;
  imagePath: string;
  platforms: SocialPlatform[];
  createdBy: string | null;
}

/**
 * Create a post and assign it the next free weekly slot (after the latest
 * already-queued post, so posts stack onto successive weeks).
 */
export async function createSocialPost(input: CreateSocialPostInput): Promise<SocialPost> {
  const [config, posts] = await Promise.all([getSocialConfig(), listSocialPosts()]);
  const claimed = activeSlots(posts);
  const anchor = claimed.length ? new Date(Math.max(...claimed)) : new Date();
  const scheduledAt = nextSlotAfter(anchor, config.weeklySlot, config.timezone);

  const post: SocialPost = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
    coreCaption: input.coreCaption,
    hashtags: input.hashtags,
    link: input.link,
    imagePath: input.imagePath,
    platforms: input.platforms,
    status: "queued",
    scheduledAt: scheduledAt.toISOString(),
    reviewToken: randomBytes(24).toString("hex"),
    reviewEmailSentAt: null,
    reviewedAt: null,
    reviewNote: null,
    publishedAt: null,
    results: {},
  };

  const service = supabaseService();
  const { error } = await service
    .from("site_settings")
    .insert({ key: `${POST_PREFIX}${post.id}`, value: post as never });
  if (error) throw new Error(`Failed to create social post: ${error.message}`);
  return post;
}

export async function updateSocialPost(
  id: string,
  patch: Partial<SocialPost>,
): Promise<SocialPost | null> {
  const current = await getSocialPost(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  const service = supabaseService();
  const { error } = await service
    .from("site_settings")
    .update({ value: next as never })
    .eq("key", `${POST_PREFIX}${id}`);
  if (error) throw new Error(`Failed to update social post: ${error.message}`);
  return next;
}

export async function deleteSocialPost(id: string): Promise<void> {
  const service = supabaseService();
  const { error } = await service.from("site_settings").delete().eq("key", `${POST_PREFIX}${id}`);
  if (error) throw new Error(`Failed to delete social post: ${error.message}`);
}

/** Public URL for an image in the social-media bucket. */
export function socialImageUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/social-media/${path}`;
}
