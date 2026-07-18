"use server";

/**
 * Admin mutations for the social auto-poster: queue a post, review it
 * (approve / reject / cancel / delete), edit the schedule config, and test the
 * Meta connection.
 *
 * Every action authorizes with requireAdmin() BEFORE touching
 * supabaseService()/the store, and records an audit entry on success.
 */

import { refresh } from "next/cache";
import { requireAdmin, auditLog } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import {
  createSocialPost,
  deleteSocialPost,
  getSocialConfig,
  getSocialPost,
  saveSocialConfig,
  updateSocialPost,
} from "@/lib/social/store";
import { formatSlot } from "@/lib/social/slot";
import { metaConfigured, verifyMetaConnection } from "@/lib/social/meta";
import { SOCIAL_STATUS_LABELS, type SocialConfig } from "@/lib/social/types";
import {
  parseOrErrors,
  socialConfigFormSchema,
  socialPostCreateSchema,
  socialPostIdSchema,
} from "@/lib/validation";
import {
  failure,
  fdBool,
  fdString,
  success,
  type ActionState,
} from "@/server/actions/admin/action-result";

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createSocialPostAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const platforms = formData
    .getAll("platforms")
    .filter((v): v is string => typeof v === "string");

  const parsed = parseOrErrors(socialPostCreateSchema, {
    coreCaption: fdString(formData, "coreCaption"),
    hashtags: fdString(formData, "hashtags"),
    link: fdString(formData, "link"),
    imagePath: fdString(formData, "imagePath"),
    platforms,
  });
  if (!parsed.ok) return failure("Please fix the highlighted fields", parsed.errors);
  const d = parsed.data;

  let scheduledAt: string;
  let postId: string;
  try {
    const post = await createSocialPost({
      coreCaption: d.coreCaption,
      hashtags: d.hashtags ?? "",
      link: d.link ?? "",
      imagePath: d.imagePath,
      platforms: d.platforms,
      createdBy: admin.id,
    });
    scheduledAt = post.scheduledAt;
    postId = post.id;
  } catch (e) {
    return failure(e instanceof Error ? e.message : "Could not queue the post");
  }

  await auditLog(admin.id, "social.post_create", "social", postId, {
    platforms: d.platforms,
    scheduledAt,
  });
  refresh();
  return success(
    `Post queued for ${formatSlot(scheduledAt)}. You'll get an email to approve it before it publishes.`,
  );
}

// ---------------------------------------------------------------------------
// Review (approve / reject / cancel)
// ---------------------------------------------------------------------------

async function applyReview(
  adminId: string,
  postId: string,
  status: "approved" | "rejected",
): Promise<ActionState> {
  const post = await getSocialPost(postId);
  if (!post) return failure("Post not found");
  if (post.status !== "queued" && post.status !== "pending_review") {
    return failure(
      `Only a queued or awaiting-approval post can be ${
        status === "approved" ? "approved" : "rejected"
      }.`,
    );
  }

  try {
    await updateSocialPost(postId, { status, reviewedAt: new Date().toISOString() });
  } catch (e) {
    return failure(e instanceof Error ? e.message : "Update failed");
  }

  await auditLog(
    adminId,
    status === "approved" ? "social.post_approve" : "social.post_reject",
    "social",
    postId,
    { from: post.status },
  );
  refresh();
  return success(
    status === "approved"
      ? "Post approved — it will publish at its scheduled slot."
      : "Post rejected — it won't be published.",
  );
}

export async function approveSocialPostAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseOrErrors(socialPostIdSchema, { postId: fdString(formData, "postId") });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);
  return applyReview(admin.id, parsed.data.postId, "approved");
}

export async function rejectSocialPostAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseOrErrors(socialPostIdSchema, { postId: fdString(formData, "postId") });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);
  return applyReview(admin.id, parsed.data.postId, "rejected");
}

export async function cancelSocialPostAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseOrErrors(socialPostIdSchema, { postId: fdString(formData, "postId") });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);
  const { postId } = parsed.data;

  const post = await getSocialPost(postId);
  if (!post) return failure("Post not found");
  if (post.status !== "queued" && post.status !== "pending_review" && post.status !== "approved") {
    return failure(`A ${SOCIAL_STATUS_LABELS[post.status].toLowerCase()} post can't be cancelled.`);
  }

  try {
    await updateSocialPost(postId, { status: "cancelled" });
  } catch (e) {
    return failure(e instanceof Error ? e.message : "Update failed");
  }

  await auditLog(admin.id, "social.post_cancel", "social", postId, { from: post.status });
  refresh();
  return success("Post cancelled.");
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteSocialPostAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseOrErrors(socialPostIdSchema, { postId: fdString(formData, "postId") });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);
  const { postId } = parsed.data;

  const post = await getSocialPost(postId);
  if (!post) return failure("Post not found");

  // Best-effort image cleanup — a storage failure must not block the delete.
  if (post.imagePath && !post.imagePath.startsWith("http")) {
    try {
      const { error } = await supabaseService().storage
        .from("social-media")
        .remove([post.imagePath]);
      if (error) console.error("social image remove failed:", error.message);
    } catch (e) {
      console.error("social image remove threw:", e);
    }
  }

  try {
    await deleteSocialPost(postId);
  } catch (e) {
    return failure(e instanceof Error ? e.message : "Delete failed");
  }

  await auditLog(admin.id, "social.post_delete", "social", postId, {
    status: post.status,
    imagePath: post.imagePath,
  });
  refresh();
  return success("Post deleted.");
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export async function saveSocialConfigAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(socialConfigFormSchema, {
    dayOfWeek: fdString(formData, "dayOfWeek"),
    hour: fdString(formData, "hour"),
    minute: fdString(formData, "minute"),
    reviewLeadHours: fdString(formData, "reviewLeadHours"),
    defaultHashtags: fdString(formData, "defaultHashtags"),
    facebook: fdBool(formData, "facebook"),
    instagram: fdBool(formData, "instagram"),
    enabled: fdBool(formData, "enabled"),
  });
  if (!parsed.ok) return failure("Please fix the highlighted fields", parsed.errors);
  const d = parsed.data;

  const current = await getSocialConfig();
  // fbPageId / igUserId / timezone are owned by the Meta connect step — never
  // overwritten from this form.
  const next: SocialConfig = {
    ...current,
    weeklySlot: { dayOfWeek: d.dayOfWeek, hour: d.hour, minute: d.minute },
    reviewLeadHours: d.reviewLeadHours,
    defaultHashtags: d.defaultHashtags ?? "",
    platforms: { facebook: d.facebook, instagram: d.instagram },
    enabled: d.enabled,
  };

  try {
    await saveSocialConfig(next);
  } catch (e) {
    return failure(e instanceof Error ? e.message : "Save failed");
  }

  await auditLog(admin.id, "social.config_save", "social", "config", {
    enabled: d.enabled,
    weeklySlot: next.weeklySlot,
    platforms: next.platforms,
  });
  refresh();
  return success("Settings saved.");
}

// ---------------------------------------------------------------------------
// Test connection
// ---------------------------------------------------------------------------

export async function testConnectionAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  if (!metaConfigured()) {
    await auditLog(admin.id, "social.test_connection", "social", "config", { configured: false });
    return failure(
      "Meta isn't connected yet — set META_ACCESS_TOKEN and the account IDs. See docs/SOCIAL-SETUP.md.",
    );
  }

  const config = await getSocialConfig();
  const result = await verifyMetaConnection(config.fbPageId, config.igUserId);
  await auditLog(admin.id, "social.test_connection", "social", "config", {
    facebook: result.facebook ?? null,
    instagram: result.instagram ?? null,
    error: result.error ?? null,
  });

  if (result.error) return failure(`Connection problem: ${result.error}`);

  const parts: string[] = [];
  if (result.facebook) parts.push(`Facebook Page: ${result.facebook}`);
  if (result.instagram) parts.push(`Instagram: @${result.instagram}`);
  if (parts.length === 0) {
    return failure(
      "No Facebook Page or Instagram account is set yet — finish the Meta connect step (docs/SOCIAL-SETUP.md).",
    );
  }
  return success(`Connected — ${parts.join(" · ")}.`);
}
