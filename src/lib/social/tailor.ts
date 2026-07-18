/**
 * Per-platform caption tailoring (pure, deterministic — unit-testable).
 *
 * The owner writes one core message + optional hashtags + optional link. Each
 * platform gets a version adapted to its norms:
 *   - Facebook: message + the link on its own line (FB renders link previews).
 *   - Instagram: message + hashtags; links aren't clickable in captions, so a
 *     "🔗 Link in bio" line replaces the URL.
 */

export interface TailorInput {
  coreCaption: string;
  hashtags: string;
  link: string;
}

function clean(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function facebookCaption(input: TailorInput): string {
  const parts = [clean(input.coreCaption)];
  const link = input.link.trim();
  if (link) parts.push(link);
  const tags = input.hashtags.trim();
  if (tags) parts.push(tags);
  return parts.filter(Boolean).join("\n\n");
}

export function instagramCaption(input: TailorInput): string {
  const parts = [clean(input.coreCaption)];
  if (input.link.trim()) parts.push("🔗 Link in bio");
  const tags = input.hashtags.trim();
  if (tags) parts.push(tags);
  // Instagram hard-caps captions at 2,200 chars.
  return parts.filter(Boolean).join("\n\n").slice(0, 2200);
}
