import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 proxy (successor of middleware):
 *  1. Refreshes the Supabase auth session cookie on every matched request.
 *  2. Redirects unauthenticated visitors away from account/checkout/admin.
 * Admin MEMBERSHIP is enforced server-side in requireAdmin() — the proxy only
 * guarantees a session exists.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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

  const path = request.nextUrl.pathname;
  const requiresAuth =
    path.startsWith("/account") || path.startsWith("/checkout") || path.startsWith("/admin");

  if (requiresAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
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
