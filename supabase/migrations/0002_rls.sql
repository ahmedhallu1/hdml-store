-- HDML Wholesale Store — 0002_rls
-- Row Level Security. Principles:
--   * The public (anon) may read the active catalog and active payment methods.
--   * Customers may read their own profile/orders; they may edit only their profile.
--   * ALL writes to orders, proofs, invoices, settings, products go through the
--     server (service role key, which bypasses RLS) after explicit authorization
--     checks in application code.
--   * Tables with RLS enabled and no policy are fully closed to anon/authenticated.

alter table public.import_batches       enable row level security;
alter table public.categories           enable row level security;
alter table public.brands               enable row level security;
alter table public.products             enable row level security;
alter table public.product_price_tiers  enable row level security;
alter table public.customer_profiles    enable row level security;
alter table public.payment_methods      enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payment_proofs       enable row level security;
alter table public.invoices             enable row level security;
alter table public.email_events         enable row level security;
alter table public.site_settings        enable row level security;
alter table public.admin_profiles       enable row level security;
alter table public.admin_audit_logs     enable row level security;
alter table public.rate_limits          enable row level security;

-- Catalog: public read of active rows only.
create policy categories_public_read on public.categories
  for select to anon, authenticated using (true);

create policy brands_public_read on public.brands
  for select to anon, authenticated using (true);

create policy products_public_read on public.products
  for select to anon, authenticated using (active = true);

create policy price_tiers_public_read on public.product_price_tiers
  for select to anon, authenticated using (
    exists (select 1 from public.products p where p.id = product_id and p.active)
  );

-- Payment methods: customers must see where to send money.
create policy payment_methods_public_read on public.payment_methods
  for select to anon, authenticated using (active = true);

-- Customer profiles: owner only.
create policy customer_profiles_own_select on public.customer_profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy customer_profiles_own_insert on public.customer_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy customer_profiles_own_update on public.customer_profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Orders: customers read their own; admins read all. No client writes.
create policy orders_own_select on public.orders
  for select to authenticated
  using (customer_id = (select auth.uid()) or public.is_admin());

create policy order_items_own_select on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.customer_id = (select auth.uid()) or public.is_admin())
    )
  );

create policy order_status_history_own_select on public.order_status_history
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.customer_id = (select auth.uid()) or public.is_admin())
    )
  );

-- Payment proofs / invoices / email events: server-only (no policies).
-- Customers see proof & invoice STATE via server-rendered pages and receive
-- files through short-lived signed URLs created with the service role.

-- Admin profiles: a user may check their own admin membership.
create policy admin_profiles_own_select on public.admin_profiles
  for select to authenticated using (user_id = (select auth.uid()));

-- site_settings, admin_audit_logs, email_events, import_batches, rate_limits:
-- intentionally no policies -> closed to client roles; service role only.
