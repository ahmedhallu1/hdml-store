/**
 * Server component: the social-post queue as a table. Interactive controls are
 * small <ActionForm> wrappers (client) fed the module's server actions.
 */

import { Badge } from "@/components/ui/badge";
import { ActionForm } from "@/components/admin/action-form";
import { EmptyState, TableShell, Td, Th } from "@/components/admin/ui";
import { formatSlot } from "@/lib/social/slot";
import { socialImageUrl } from "@/lib/social/store";
import {
  SOCIAL_STATUS_LABELS,
  type SocialConfig,
  type SocialPost,
  type SocialPlatform,
  type SocialPostStatus,
} from "@/lib/social/types";
import {
  approveSocialPostAction,
  cancelSocialPostAction,
  deleteSocialPostAction,
  rejectSocialPostAction,
} from "@/server/actions/admin/social";

type Tone = "gray" | "amber" | "blue" | "green" | "red";

const STATUS_TONES: Record<SocialPostStatus, Tone> = {
  queued: "gray",
  pending_review: "amber",
  approved: "blue",
  published: "green",
  failed: "red",
  rejected: "red",
  cancelled: "gray",
};

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  facebook: "FB",
  instagram: "IG",
};

function PostResults({ post }: { post: SocialPost }) {
  if (post.status !== "published" && post.status !== "failed") return null;
  const rows = post.platforms
    .map((p) => ({ platform: p, result: post.results[p] }))
    .filter((r) => r.result);
  if (rows.length === 0) return null;
  return (
    <div className="mt-1 space-y-0.5">
      {rows.map(({ platform, result }) => (
        <p key={platform} className="text-xs">
          <span className="font-medium text-gray-500">{PLATFORM_LABEL[platform]}:</span>{" "}
          {result?.permalink ? (
            <a
              href={result.permalink}
              target="_blank"
              rel="noreferrer"
              className="text-brand-700 hover:underline"
            >
              View post
            </a>
          ) : result?.error ? (
            <span className="text-red-600">{result.error}</span>
          ) : (
            <span className="text-gray-400">sent</span>
          )}
        </p>
      ))}
    </div>
  );
}

function PostIdField({ id }: { id: string }) {
  return <input type="hidden" name="postId" value={id} />;
}

function RowActions({ post }: { post: SocialPost }) {
  const showApproval = post.status === "pending_review";
  const showCancel = post.status === "queued" || post.status === "approved";
  return (
    <div className="flex flex-wrap gap-1.5">
      {showApproval && (
        <>
          <ActionForm
            action={approveSocialPostAction}
            submitLabel="Approve"
            submitVariant="primary"
            submitSize="sm"
            hideMessage
          >
            <PostIdField id={post.id} />
          </ActionForm>
          <ActionForm
            action={rejectSocialPostAction}
            submitLabel="Reject"
            submitVariant="outline"
            submitSize="sm"
            confirmMessage="Reject this post? It won't be published."
            hideMessage
          >
            <PostIdField id={post.id} />
          </ActionForm>
        </>
      )}
      {showCancel && (
        <ActionForm
          action={cancelSocialPostAction}
          submitLabel="Cancel"
          submitVariant="outline"
          submitSize="sm"
          confirmMessage="Cancel this scheduled post?"
          hideMessage
        >
          <PostIdField id={post.id} />
        </ActionForm>
      )}
      <ActionForm
        action={deleteSocialPostAction}
        submitLabel="Delete"
        submitVariant="danger"
        submitSize="sm"
        confirmMessage="Delete this post and its image permanently? This cannot be undone."
        hideMessage
      >
        <PostIdField id={post.id} />
      </ActionForm>
    </div>
  );
}

export function QueueTable({ posts, config }: { posts: SocialPost[]; config: SocialConfig }) {
  if (posts.length === 0) {
    return (
      <EmptyState
        title="No posts queued yet"
        hint="Create a post — it lands in the next weekly slot and waits for your approval before publishing."
      />
    );
  }

  return (
    <TableShell>
      <thead>
        <tr>
          <Th>Image</Th>
          <Th>Caption</Th>
          <Th>Platforms</Th>
          <Th>Slot</Th>
          <Th>Status</Th>
          <Th>Actions</Th>
        </tr>
      </thead>
      <tbody>
        {posts.map((post) => (
          <tr key={post.id} className="hover:bg-gray-50">
            <Td>
              {post.imagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={socialImageUrl(post.imagePath)}
                  alt=""
                  className="size-12 rounded-md border border-gray-200 object-cover"
                />
              ) : (
                <div className="size-12 rounded-md border border-dashed border-gray-200 bg-gray-50" />
              )}
            </Td>
            <Td>
              <p className="line-clamp-2 max-w-xs whitespace-pre-wrap text-gray-700">
                {post.coreCaption}
              </p>
            </Td>
            <Td>
              <div className="flex flex-wrap gap-1">
                {post.platforms.map((p) => (
                  <Badge key={p} tone={p === "facebook" ? "blue" : "brand"}>
                    {PLATFORM_LABEL[p]}
                  </Badge>
                ))}
              </div>
            </Td>
            <Td className="whitespace-nowrap text-gray-500">
              {formatSlot(post.scheduledAt, config.timezone)}
            </Td>
            <Td>
              <Badge tone={STATUS_TONES[post.status]}>{SOCIAL_STATUS_LABELS[post.status]}</Badge>
              <PostResults post={post} />
            </Td>
            <Td>
              <RowActions post={post} />
            </Td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}
