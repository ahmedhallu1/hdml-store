import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-path";

/**
 * Landing point for Supabase auth email links (password recovery).
 *
 * Why this exists: the proxy redirects unauthenticated visitors away from
 * /account/* and drops the query string, so a recovery link pointing straight
 * at /account/update-password would lose its ?code. This PUBLIC route
 * exchanges the code for a session first (route handlers may write cookies),
 * then forwards to the guarded page.
 *
 * Supports both link styles:
 *   ?code=...                     (PKCE, default for @supabase/ssr)
 *   ?token_hash=...&type=recovery (customized email templates)
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const nextRaw = url.searchParams.get("next");
  const next = safeNextPath(nextRaw, "/account/update-password");

  const failure = new URL("/login?error=recovery", url.origin);
  const success = new URL(next, url.origin);

  const supabase = await supabaseServer();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(success);
    console.error("auth/confirm code exchange failed:", error.message);
    return NextResponse.redirect(failure);
  }

  if (tokenHash && (type === "recovery" || type === "email")) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "recovery" | "email",
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(success);
    console.error("auth/confirm verifyOtp failed:", error.message);
    return NextResponse.redirect(failure);
  }

  return NextResponse.redirect(failure);
}
