/**
 * Meta Graph API client — publishes photo posts to a Facebook Page and an
 * Instagram Business account. Server-only (uses the secret access token).
 *
 * Token: process.env.META_ACCESS_TOKEN — a long-lived Page token or a System
 * User token with pages_manage_posts + instagram_content_publish.
 * IDs come from the social config (fbPageId, igUserId).
 *
 * Never throws — every function returns { postId } or { error }.
 */

import "server-only";
import type { SocialPostResult } from "./types";

const GRAPH = "https://graph.facebook.com/v21.0";

function token(): string {
  return process.env.META_ACCESS_TOKEN ?? "";
}

export function metaConfigured(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN);
}

async function graph(
  path: string,
  method: "GET" | "POST",
  params: Record<string, string>,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const url = new URL(`${GRAPH}/${path}`);
  const body = new URLSearchParams({ ...params, access_token: token() });
  try {
    const res =
      method === "GET"
        ? await fetch(`${url}?${body}`)
        : await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body,
          });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok || (data.error as { message?: string } | undefined)) {
      const err = data.error as { message?: string } | undefined;
      return { ok: false, error: err?.message ?? `Graph ${res.status}` };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
}

/** Publish a photo + caption to a Facebook Page. */
export async function publishToFacebook(
  pageId: string,
  imageUrl: string,
  caption: string,
): Promise<SocialPostResult> {
  if (!pageId) return { error: "Facebook Page ID is not configured." };
  const r = await graph(`${pageId}/photos`, "POST", { url: imageUrl, caption });
  if (!r.ok) return { error: r.error };
  const postId = (r.data.post_id ?? r.data.id) as string | undefined;
  return {
    postId,
    permalink: postId ? `https://facebook.com/${postId}` : undefined,
  };
}

/**
 * Publish a photo + caption to an Instagram Business account.
 * Two-step: create a media container, wait until it is FINISHED, then publish.
 */
export async function publishToInstagram(
  igUserId: string,
  imageUrl: string,
  caption: string,
): Promise<SocialPostResult> {
  if (!igUserId) return { error: "Instagram account ID is not configured." };

  const create = await graph(`${igUserId}/media`, "POST", { image_url: imageUrl, caption });
  if (!create.ok) return { error: create.error };
  const containerId = create.data.id as string | undefined;
  if (!containerId) return { error: "Instagram did not return a media container." };

  // Poll container status (usually FINISHED within a couple of seconds).
  for (let attempt = 0; attempt < 10; attempt++) {
    const status = await graph(containerId, "GET", { fields: "status_code,status" });
    if (!status.ok) return { error: status.error };
    const code = status.data.status_code as string | undefined;
    if (code === "FINISHED") break;
    if (code === "ERROR" || code === "EXPIRED") {
      return { error: `Instagram media processing ${code}: ${status.data.status ?? ""}` };
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  const publish = await graph(`${igUserId}/media_publish`, "POST", { creation_id: containerId });
  if (!publish.ok) return { error: publish.error };
  const mediaId = publish.data.id as string | undefined;
  return { postId: mediaId };
}

/**
 * Sanity check the token + IDs by reading the page and IG account names.
 * Used by the admin "Test connection" button.
 */
export async function verifyMetaConnection(
  fbPageId: string,
  igUserId: string,
): Promise<{ facebook?: string; instagram?: string; error?: string }> {
  if (!metaConfigured()) return { error: "META_ACCESS_TOKEN is not set." };
  const out: { facebook?: string; instagram?: string; error?: string } = {};
  if (fbPageId) {
    const r = await graph(fbPageId, "GET", { fields: "name" });
    if (r.ok) out.facebook = r.data.name as string;
    else out.error = r.error;
  }
  if (igUserId) {
    const r = await graph(igUserId, "GET", { fields: "username" });
    if (r.ok) out.instagram = r.data.username as string;
    else out.error = out.error ?? r.error;
  }
  return out;
}
