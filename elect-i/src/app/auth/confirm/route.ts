import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { ensureAccount } from "@/lib/auth";
import { safeNextPath } from "@/lib/validation";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";

/**
 * Landing point for Supabase auth email links (signup confirmation and
 * password recovery).
 *
 * Why this route exists: middleware redirects unauthenticated visitors away
 * from /[lang]/account/* and drops the query string, so a recovery link
 * pointing straight at the guarded page would lose its code. This PUBLIC
 * route exchanges the code for a session first (route handlers may write
 * cookies), then forwards on.
 *
 * It sits outside the [lang] segment, so the locale is recovered from the
 * `next` path.
 *
 * Supports both link styles:
 *   ?code=...                            (PKCE, default for @supabase/ssr)
 *   ?token_hash=...&type=recovery|email  (customised email templates)
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  const next = safeNextPath(url.searchParams.get("next"));
  const segment = next?.split("/").filter(Boolean)[0];
  const lang = segment && isLocale(segment) ? segment : DEFAULT_LOCALE;

  const success = new URL(next ?? `/${lang}/account`, url.origin);
  const failure = new URL(`/${lang}/login?error=recovery`, url.origin);

  const supabase = await supabaseServer();

  let verified = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) console.error("auth/confirm code exchange failed:", error.message);
    verified = !error;
  } else if (
    tokenHash &&
    (type === "recovery" || type === "email" || type === "signup" || type === "magiclink" || type === "invite")
  ) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "recovery" | "email" | "signup" | "magiclink" | "invite",
      token_hash: tokenHash,
    });
    if (error) console.error("auth/confirm verifyOtp failed:", error.message);
    verified = !error;
  }

  if (!verified) return NextResponse.redirect(failure);

  // First confirmed sign-in is where a shared auth user gets its ELECT-I row.
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    try {
      await ensureAccount(data.user, lang);
    } catch (error) {
      console.error("account provisioning failed after confirm:", error);
    }
  }

  return NextResponse.redirect(success);
}
