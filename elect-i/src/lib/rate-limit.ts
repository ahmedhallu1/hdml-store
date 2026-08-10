import "server-only";
import { supabaseService } from "@/lib/supabase/server";

/**
 * Fixed-window rate limiter backed by eig.rate_limits.
 *
 * Public forms (quotation requests, supplier applications, contact messages)
 * are unauthenticated, so they are limited per client IP and per submitted
 * email. The window is deliberately coarse — this exists to stop scripted
 * abuse, not to meter a paid API.
 *
 * Fails OPEN: a limiter outage must never take a public form offline. Every
 * failure is logged so it stays visible.
 */
export async function rateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const service = supabaseService();
    const now = Date.now();

    const { data, error } = await service
      .from("rate_limits")
      .select("count, window_start")
      .eq("bucket", bucket)
      .maybeSingle();

    if (error) {
      console.error("rate limit read failed:", error.message);
      return true;
    }

    const row = data as { count: number; window_start: string } | null;
    const windowExpired =
      !row || now - new Date(row.window_start).getTime() >= windowSeconds * 1000;

    if (windowExpired) {
      const { error: upsertError } = await service
        .from("rate_limits")
        .upsert({ bucket, count: 1, window_start: new Date(now).toISOString() });
      if (upsertError) console.error("rate limit reset failed:", upsertError.message);
      return true;
    }

    if (row.count >= limit) return false;

    const { error: bumpError } = await service
      .from("rate_limits")
      .update({ count: row.count + 1 })
      .eq("bucket", bucket);
    if (bumpError) console.error("rate limit bump failed:", bumpError.message);
    return true;
  } catch (err) {
    console.error("rate limit error:", err);
    return true;
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the current window rolls over. */
  resetInSeconds: number;
}

/**
 * Same limiter, but reporting how long the caller must wait.
 *
 * The claim page needs this: telling a recipient "too many attempts" without
 * saying when they can retry strands someone from an order that is already
 * paid for. Shares the eig.rate_limits table with `rateLimit` above.
 */
export async function rateLimitDetailed(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const service = supabaseService();
    const now = Date.now();

    const { data, error } = await service
      .from("rate_limits")
      .select("count, window_start")
      .eq("bucket", bucket)
      .maybeSingle();

    if (error) {
      console.error("rate limit read failed:", error.message);
      return { allowed: true, remaining: limit, resetInSeconds: windowSeconds };
    }

    const row = data as { count: number; window_start: string } | null;
    const elapsedSeconds = row ? (now - new Date(row.window_start).getTime()) / 1000 : Infinity;

    if (!row || elapsedSeconds >= windowSeconds) {
      await service
        .from("rate_limits")
        .upsert({ bucket, count: 1, window_start: new Date(now).toISOString() });
      return { allowed: true, remaining: limit - 1, resetInSeconds: windowSeconds };
    }

    const resetInSeconds = Math.max(1, Math.ceil(windowSeconds - elapsedSeconds));
    if (row.count >= limit) {
      return { allowed: false, remaining: 0, resetInSeconds };
    }

    await service
      .from("rate_limits")
      .update({ count: row.count + 1 })
      .eq("bucket", bucket);
    return { allowed: true, remaining: Math.max(0, limit - row.count - 1), resetInSeconds };
  } catch (err) {
    console.error("rate limit error:", err);
    return { allowed: true, remaining: limit, resetInSeconds: windowSeconds };
  }
}

/** Stable client identifier from request headers (Cloudflare / proxy aware). */
export function clientIpFrom(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * Bucket keys are stored in a primary-key text column, so anything derived
 * from user input is normalised and truncated before it gets there.
 */
export function bucketKey(scope: string, ...parts: Array<string | null | undefined>): string {
  const tail = parts
    .filter((p): p is string => Boolean(p))
    .map((p) => p.trim().toLowerCase().slice(0, 96))
    .join(":");
  return `${scope}:${tail || "anonymous"}`;
}
