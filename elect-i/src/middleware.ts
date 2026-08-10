import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALES, matchLocale } from "@/i18n/config";

/**
 * Edge middleware (the OpenNext Cloudflare adapter does not support Next 16's
 * Node `proxy.ts` yet):
 *   1. Redirects locale-less paths to the visitor's best-matching locale.
 *   2. Refreshes the Supabase auth session cookie on every matched request.
 *   3. Redirects unauthenticated visitors away from gated areas.
 *
 * Tier MEMBERSHIP is enforced server-side in requireTier() — middleware only
 * guarantees that a session exists.
 */

const LOCALE_COOKIE = "eig_locale";

/** Paths that live outside the [lang] segment and must not be localised. */
function isExempt(path: string): boolean {
  return (
    path.startsWith("/api/") ||
    // Supabase auth callbacks (email confirmation, password reset, magic
    // links) land here. Locale-prefixing them would 404 and break those flows.
    path.startsWith("/auth/") ||
    path.startsWith("/_next/") ||
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    path === "/favicon.ico" ||
    path.startsWith("/brand/")
  );
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (!isExempt(path)) {
    const hasLocale = LOCALES.some((l) => path === `/${l}` || path.startsWith(`/${l}/`));
    if (!hasLocale) {
      const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
      const locale =
        cookieLocale && LOCALES.includes(cookieLocale as (typeof LOCALES)[number])
          ? cookieLocale
          : matchLocale(request.headers.get("accept-language"));
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}${path === "/" ? "" : path}`;
      return NextResponse.redirect(url);
    }
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "eig" },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Do not add logic between client creation and getUser(): the call refreshes
  // expired tokens and rewrites cookies as a side effect.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const segments = path.split("/").filter(Boolean);
  const locale = segments[0] ?? DEFAULT_LOCALE;
  const rest = `/${segments.slice(1).join("/")}`;

  // /claim/* is deliberately NOT gated: the token is the secret and the
  // recipient has no account.
  const requiresAuth =
    rest.startsWith("/account") || rest.startsWith("/dashboard") || rest.startsWith("/admin");

  if (requiresAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static files and images.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|brand/|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt)$).*)",
  ],
};
