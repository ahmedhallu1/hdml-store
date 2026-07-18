/** Social-media auto-posting domain types. */

export type SocialPlatform = "facebook" | "instagram";

export type SocialPostStatus =
  | "queued" // waiting; review email not sent yet
  | "pending_review" // review email sent, awaiting approval
  | "approved" // approved; will publish at scheduledAt
  | "rejected" // owner rejected; will not publish
  | "published" // sent to the platforms
  | "failed" // publish attempted but errored
  | "cancelled"; // manually cancelled

export interface SocialPostResult {
  postId?: string;
  permalink?: string;
  error?: string;
}

export interface SocialPost {
  id: string;
  createdAt: string;
  createdBy: string | null;
  /** The single message the owner writes; tailored per platform at publish. */
  coreCaption: string;
  hashtags: string;
  link: string;
  /** Path inside the public `social-media` bucket. Required for Instagram. */
  imagePath: string;
  platforms: SocialPlatform[];
  status: SocialPostStatus;
  /** ISO timestamp of the weekly slot this post is assigned to. */
  scheduledAt: string;
  reviewToken: string;
  reviewEmailSentAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  publishedAt: string | null;
  results: Partial<Record<SocialPlatform, SocialPostResult>>;
}

export interface WeeklySlot {
  /** 0 = Sunday … 6 = Saturday (Cairo local time). */
  dayOfWeek: number;
  hour: number;
  minute: number;
}

export interface SocialConfig {
  weeklySlot: WeeklySlot;
  timezone: string;
  reviewLeadHours: number;
  defaultHashtags: string;
  platforms: { facebook: boolean; instagram: boolean };
  /** Facebook Page ID and Instagram Business user ID (from the Meta setup). */
  fbPageId: string;
  igUserId: string;
  /** Whether the whole auto-poster is armed. */
  enabled: boolean;
}

export const DEFAULT_SOCIAL_CONFIG: SocialConfig = {
  weeklySlot: { dayOfWeek: 0, hour: 19, minute: 0 }, // Sunday 19:00 Cairo
  timezone: "Africa/Cairo",
  reviewLeadHours: 24,
  defaultHashtags: "#HDML #wholesale #electronics #Egypt",
  platforms: { facebook: true, instagram: true },
  fbPageId: "",
  igUserId: "",
  enabled: false,
};

export const SOCIAL_STATUS_LABELS: Record<SocialPostStatus, string> = {
  queued: "Queued",
  pending_review: "Awaiting your approval",
  approved: "Approved — scheduled",
  rejected: "Rejected",
  published: "Published",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
