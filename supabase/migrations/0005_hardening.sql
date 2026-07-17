-- HDML Wholesale Store — 0005_hardening
-- Security-advisor follow-ups after the initial schema went live.

-- 1) rate_limit_hit is SECURITY DEFINER and must be callable ONLY by the
--    server (service role). Supabase grants EXECUTE to anon/authenticated by
--    default; revoke it so the counters can't be inflated via the public RPC.
revoke execute on function public.rate_limit_hit(text, int, int) from anon, authenticated;

-- 2) Public storage buckets serve object URLs WITHOUT any RLS policy. The broad
--    SELECT policies additionally allowed clients to LIST every filename, which
--    is unnecessary. Drop them (public URL reads keep working).
drop policy if exists "public read product images" on storage.objects;
drop policy if exists "public read site assets" on storage.objects;

-- 3) Pin the trigger helper's search_path (advisor: function_search_path_mutable).
alter function public.set_updated_at() set search_path = '';

-- Note (intentional, not fixed): pg_trgm lives in the public schema (moving it
-- would rebuild the products name index for no security benefit here), and
-- is_admin() stays EXECUTE-able by anon/authenticated because the RLS policies
-- invoke it in the caller's role context — it only ever reveals the caller's
-- OWN admin status.
