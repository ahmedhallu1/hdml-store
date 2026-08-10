-- ---------------------------------------------------------------------------
-- 0009 — lifetime billing rollups
--
-- The billing page shows four lifetime totals (all payments, orders, wallet
-- top-ups, membership). It cannot compute them in the app: PostgREST rejects
-- aggregate functions on this project ("Use of aggregate functions is not
-- allowed") and caps every response at 1000 rows, while an active account has
-- tens of thousands of payment rows. So the sum happens where the data lives.
--
-- SECURITY DEFINER + execute granted only to service_role: the function takes
-- an account id as an argument, so leaving it callable by `authenticated`
-- would let any signed-in user read another account's turnover. Every caller
-- goes through requireTier() on the server first.
-- ---------------------------------------------------------------------------

create or replace function eig.billing_summary(p_account uuid)
returns table (purpose text, paid_total numeric, paid_count bigint)
language sql
stable
security definer
set search_path = eig, public
as $$
  select p.purpose, coalesce(sum(p.amount), 0)::numeric, count(*)::bigint
  from eig.payments p
  where p.account_id = p_account
    and p.status = 'paid'
  group by p.purpose
$$;

revoke all on function eig.billing_summary(uuid) from public;
revoke all on function eig.billing_summary(uuid) from anon, authenticated;
grant execute on function eig.billing_summary(uuid) to service_role;

-- PostgREST caches the schema; without this the new RPC 404s until the next
-- connection pool restart.
notify pgrst, 'reload schema';
