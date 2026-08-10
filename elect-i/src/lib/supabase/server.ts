import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * ELECT-I shares the HDML Supabase project but reads and writes ONLY the
 * `eig` schema. Both clients below are pinned to it, so a stray query can
 * never touch the HDML store's `public` tables.
 */
const SCHEMA = "eig";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

/**
 * Cookie-based client for the current visitor. Subject to RLS.
 * Use for reads and auth; never for privileged writes.
 *
 * Return types are inferred rather than annotated: annotating them as
 * `SupabaseClient` would re-widen the schema generic back to "public" and
 * silently defeat the `eig` pinning above.
 */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      db: { schema: SCHEMA },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component (read-only cookies): middleware
            // refreshes sessions, so it is safe to ignore here.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. BYPASSES RLS — server only, and every call site must
 * perform its own authorization check first. Never import in client code
 * (enforced by the "server-only" import above).
 */
export function supabaseService() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    db: { schema: SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type EigServerClient = Awaited<ReturnType<typeof supabaseServer>>;
export type EigServiceClient = ReturnType<typeof supabaseService>;
