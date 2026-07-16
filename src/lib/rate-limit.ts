import "server-only";
import { supabaseService } from "@/lib/supabase/server";

/**
 * Fixed-window rate limiting backed by the `rate_limit_hit` Postgres function
 * (see 0001_init.sql). Fails OPEN on infrastructure errors so a database
 * hiccup cannot take checkout down, but logs loudly.
 */
export async function rateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const service = supabaseService();
    const { data, error } = await service.rpc("rate_limit_hit", {
      p_bucket: bucket,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("rate_limit_hit failed:", error.message);
      return true;
    }
    return data === true;
  } catch (err) {
    console.error("rate limit error:", err);
    return true;
  }
}

/** Extract a stable client identifier from request headers (CF/proxy aware). */
export function clientIpFrom(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
