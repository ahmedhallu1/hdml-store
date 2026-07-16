-- HDML Wholesale Store — 0001_init
-- Core schema: catalog, orders, payments, invoices, settings, admin, audit.
-- Run in the Supabase SQL editor (or `supabase db push`) BEFORE 0002/0003/0004.

create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.stock_status as enum ('in_stock', 'out_of_stock', 'confirm_availability');
create type public.order_status as enum ('awaiting_payment', 'awaiting_verification', 'paid', 'fulfilled', 'cancelled');
create type public.proof_status as enum ('pending', 'approved', 'rejected');
create type public.invoice_kind as enum ('preliminary', 'final');
create type public.email_status as enum ('pending', 'sent', 'failed');
create type public.payment_kind as enum ('instapay', 'wallet');
create type public.actor_kind as enum ('customer', 'admin', 'system');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  icon text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  slug text not null unique,
  name text not null,
  original_title text not null,
  description text,
  brand_id uuid references public.brands (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  price numeric(12,2) not null check (price >= 0),
  stock_status public.stock_status not null default 'confirm_availability',
  moq int not null default 1 check (moq >= 1),
  active boolean not null default true,
  needs_review boolean not null default false,
  review_reason text,
  category_inferred boolean not null default false,
  brand_inferred boolean not null default false,
  images jsonb not null default '[]'::jsonb,
  import_batch_id uuid references public.import_batches (id) on delete set null,
  source_duplicate_count int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_name_trgm_idx on public.products using gin (name gin_trgm_ops);
create index products_category_idx on public.products (category_id) where active;
create index products_brand_idx on public.products (brand_id) where active;
create index products_active_price_idx on public.products (active, price);
create index products_created_idx on public.products (created_at desc);
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_price_tiers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  min_qty int not null check (min_qty >= 1),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  unique (product_id, min_qty)
);

-- ---------------------------------------------------------------------------
-- Customers (profile data on top of auth.users)
-- ---------------------------------------------------------------------------
create table public.customer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  company_name text,
  tax_id text,
  governorate text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger customer_profiles_updated_at before update on public.customer_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Payments configuration
-- ---------------------------------------------------------------------------
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  kind public.payment_kind not null,
  label text not null,
  number text not null,
  display_name text,
  qr_path text,
  instructions text,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_ref text not null unique,
  tracking_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  customer_id uuid not null references auth.users (id),
  status public.order_status not null default 'awaiting_payment',
  payment_method_id uuid references public.payment_methods (id) on delete set null,
  payment_method_label text not null default '',
  customer_name text not null,
  phone text not null,
  email text not null,
  company_name text,
  tax_id text,
  governorate text not null,
  address text not null,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  adjustment_total numeric(12,2) not null default 0,
  total numeric(12,2) not null check (total >= 0),
  currency text not null default 'EGP',
  idempotency_key text unique,
  customer_note text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_customer_idx on public.orders (customer_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name_snapshot text not null,
  sku_snapshot text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  qty int not null check (qty >= 1),
  amount numeric(12,2) not null check (amount >= 0),
  is_custom boolean not null default false,
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  actor public.actor_kind not null,
  actor_id uuid,
  reason text,
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create table public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  storage_path text not null,
  mime text not null,
  size_bytes int not null check (size_bytes > 0),
  original_filename text,
  status public.proof_status not null default 'pending',
  review_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index payment_proofs_order_idx on public.payment_proofs (order_id, created_at desc);
create index payment_proofs_status_idx on public.payment_proofs (status) where status = 'pending';

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  kind public.invoice_kind not null,
  pdf_path text not null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (order_id, kind)
);

create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete set null,
  kind text not null,
  recipient text not null,
  subject text,
  status public.email_status not null default 'pending',
  error text,
  provider_message_id text,
  attempts int not null default 0,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index email_events_order_idx on public.email_events (order_id);
create trigger email_events_updated_at before update on public.email_events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Settings, admin, audit
-- ---------------------------------------------------------------------------
create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

create table public.admin_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  action text not null,
  entity text,
  entity_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);

-- is_admin(): used by RLS policies. SECURITY DEFINER so it can read
-- admin_profiles regardless of the caller's own policies (no recursion).
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_profiles where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed-window counters; called with the service role only)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (bucket, window_start)
);

create or replace function public.rate_limit_hit(p_bucket text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_count int;
begin
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits (bucket, window_start, count)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;
  -- opportunistic cleanup of stale windows
  delete from public.rate_limits where window_start < now() - interval '1 day';
  return v_count <= p_limit;
end $$;
revoke all on function public.rate_limit_hit(text, int, int) from public;
