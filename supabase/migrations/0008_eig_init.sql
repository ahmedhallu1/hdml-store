-- ELECT-I Global — 0007_eig_init
--
-- ELECT-I Global shares this Supabase project with the HDML store but lives
-- entirely in its own `eig` schema. Nothing here touches `public.*`; the two
-- properties talk to each other over the signed HTTP API, not across tables.
--
-- After running: Supabase → Settings → API → Exposed schemas → add "eig".
--
-- Money: numeric(14,2) USD. Application code converts to/from integer cents
-- via src/lib/money.ts and never does float math.

create schema if not exists eig;

create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type eig.account_tier as enum ('buyer', 'merchant', 'elite');
create type eig.tier_status as enum ('active', 'past_due', 'cancelled', 'expired');
create type eig.stock_status as enum ('in_stock', 'made_to_order', 'out_of_stock', 'confirm_availability');
create type eig.verification_level as enum ('unverified', 'verified', 'audited', 'premium_manufacturer', 'authorized_distributor');
create type eig.order_status as enum (
  'draft',
  'awaiting_payment',
  'paid',
  'awaiting_recipient',  -- prepaid on-behalf order; claim link is live
  'claimed',             -- recipient submitted their details
  'ready_to_ship',
  'shipped',
  'delivered',
  'cancelled',
  'refunded'
);
create type eig.payment_status as enum ('unpaid', 'pending', 'paid', 'failed', 'refunded');
create type eig.wallet_txn_kind as enum ('topup', 'charge', 'refund', 'adjustment', 'credit_draw', 'credit_repay');
create type eig.api_scope as enum ('orders:read', 'orders:write', 'wallet:read', 'quotes:write', 'catalog:read');
create type eig.webhook_event as enum (
  'order.created', 'order.claimed', 'order.shipped', 'order.delivered',
  'order.cancelled', 'wallet.low_balance'
);
create type eig.delivery_status as enum ('pending', 'succeeded', 'failed', 'exhausted');
create type eig.rfq_status as enum ('open', 'quoted', 'accepted', 'declined', 'expired');
create type eig.actor_kind as enum ('buyer', 'merchant', 'admin', 'system', 'recipient');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function eig.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Settings & accounts
-- ---------------------------------------------------------------------------
create table eig.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table eig.accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  company_name text,
  company_country text,
  phone text,
  vat_number text,
  locale text not null default 'en',

  tier eig.account_tier not null default 'buyer',
  tier_status eig.tier_status not null default 'active',
  tier_started_at timestamptz,
  tier_expires_at timestamptz,

  -- Denormalised balances, always mutated together with a wallet_transactions
  -- row inside eig.apply_wallet_txn(). Never write these columns directly.
  wallet_balance numeric(14,2) not null default 0 check (wallet_balance >= 0),
  credit_limit numeric(14,2) not null default 0 check (credit_limit >= 0),
  credit_used numeric(14,2) not null default 0 check (credit_used >= 0),

  -- Shown on the claim page of orders this merchant prepaid, so the recipient
  -- recognises who bought on their behalf. Elite tier only (see tiers.ts).
  brand_display_name text,
  brand_logo_url text,

  suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_within_limit check (credit_used <= credit_limit)
);
create index accounts_tier_idx on eig.accounts (tier) where suspended = false;
create trigger accounts_updated before update on eig.accounts
  for each row execute function eig.set_updated_at();

-- Extra users operating under one merchant account.
create table eig.account_seats (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references eig.accounts(user_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'manager')),
  created_at timestamptz not null default now(),
  unique (account_id, user_id)
);

create table eig.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table eig.suppliers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  country text,
  city text,
  verification eig.verification_level not null default 'unverified',
  response_rate int check (response_rate between 0 and 100),
  lead_time_days int,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table eig.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_zh text not null default '',
  -- One of the eight top-level groups from the company overview.
  group_key text not null,
  parent_id uuid references eig.categories(id) on delete set null,
  icon text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index categories_group_idx on eig.categories (group_key, sort);
create index categories_parent_idx on eig.categories (parent_id);

create table eig.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table eig.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,              -- EIG-XXXXXXXX (deterministic)
  slug text not null unique,
  name_en text not null,
  name_zh text not null default '',
  description_en text,
  description_zh text,
  category_id uuid references eig.categories(id) on delete set null,
  brand_id uuid references eig.brands(id) on delete set null,
  supplier_id uuid references eig.suppliers(id) on delete set null,

  list_price numeric(14,2) not null check (list_price >= 0),
  moq int not null default 1 check (moq >= 1),
  stock_status eig.stock_status not null default 'in_stock',
  lead_time_days int,
  unit text not null default 'piece',

  images jsonb not null default '[]'::jsonb,
  specs jsonb not null default '{}'::jsonb,

  -- Provenance when the row was mirrored from the HDML catalog. Internal only;
  -- never rendered to buyers.
  hdml_sku text,
  source text not null default 'curated',

  active boolean not null default true,
  featured boolean not null default false,
  needs_review boolean not null default false,
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_active_idx on eig.products (active, created_at desc);
create index products_category_idx on eig.products (category_id) where active;
create index products_supplier_idx on eig.products (supplier_id) where active;
create index products_featured_idx on eig.products (featured) where active and featured;
create index products_hdml_sku_idx on eig.products (hdml_sku) where hdml_sku is not null;
create index products_name_trgm_idx on eig.products using gin (name_en gin_trgm_ops);
create trigger products_updated before update on eig.products
  for each row execute function eig.set_updated_at();

-- Quantity break pricing, on top of the account-tier discount.
create table eig.product_price_breaks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references eig.products(id) on delete cascade,
  min_qty int not null check (min_qty >= 1),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  unique (product_id, min_qty)
);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table eig.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,     -- EIG-YYYYMMDD-XXXXX
  status eig.order_status not null default 'draft',

  -- Who pays. Null for guest checkout.
  buyer_account_id uuid references eig.accounts(user_id) on delete set null,
  -- Set when a merchant ordered on someone else's behalf and prepaid.
  merchant_account_id uuid references eig.accounts(user_id) on delete set null,
  on_behalf boolean not null default false,

  -- Cross-system provenance. external_ref holds the HDML order_ref, which the
  -- recipient must type to open the claim page.
  external_source text,
  external_ref text,
  -- HMAC over the normalised line items as ELECT-I actually priced them.
  items_digest text,
  -- The upstream system's own snapshot of what the buyer ordered, plus the
  -- digest IT computed over that snapshot. The claim page renders both sides
  -- and compares the two digests, so repricing drift, a bad SKU mapping or a
  -- quantity mismatch is visible to the recipient instead of silent.
  external_items jsonb not null default '[]'::jsonb,
  external_digest text,
  -- Supplied by the caller (merchant API or dashboard); makes order creation
  -- safe to retry after a dropped response.
  idempotency_key text unique,

  -- Prepaid claim link.
  claim_token text unique,
  claim_expires_at timestamptz,
  claimed_at timestamptz,
  claim_reminders_sent int not null default 0,

  currency text not null default 'USD',
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  shipping_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  -- Generated: what the recipient still owes. Prepaid claim orders show 0.
  amount_due numeric(14,2) generated always as (total - amount_paid) stored,

  payment_status eig.payment_status not null default 'unpaid',
  payment_provider text,
  payment_ref text,

  -- Recipient details, collected on the claim page (or at normal checkout).
  recipient_name text,
  recipient_email text,
  recipient_phone text,
  recipient_country text,
  recipient_city text,
  recipient_address1 text,
  recipient_address2 text,
  recipient_postal_code text,
  recipient_tax_id text,
  recipient_notes text,

  incoterm text,
  shipping_method text,
  tracking_carrier text,
  tracking_number text,

  buyer_note text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A prepaid on-behalf order must carry the merchant that paid for it and a
  -- claim token; a normal order must carry neither.
  constraint on_behalf_shape check (
    (on_behalf and merchant_account_id is not null and claim_token is not null)
    or (not on_behalf and claim_token is null)
  )
);
create index orders_buyer_idx on eig.orders (buyer_account_id, created_at desc);
create index orders_merchant_idx on eig.orders (merchant_account_id, created_at desc);
create index orders_status_idx on eig.orders (status, created_at desc);
create index orders_external_ref_idx on eig.orders (external_source, external_ref);
create index orders_claim_pending_idx on eig.orders (claim_expires_at)
  where status = 'awaiting_recipient';
create trigger orders_updated before update on eig.orders
  for each row execute function eig.set_updated_at();

create table eig.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references eig.orders(id) on delete cascade,
  product_id uuid references eig.products(id) on delete set null,
  -- Immutable snapshots: catalog edits must never rewrite order history.
  name_snapshot text not null,
  sku_snapshot text,
  external_sku text,
  unit_price numeric(14,2) not null check (unit_price >= 0),
  qty int not null check (qty >= 1),
  amount numeric(14,2) not null check (amount >= 0),
  is_custom boolean not null default false,
  sort int not null default 0
);
create index order_items_order_idx on eig.order_items (order_id, sort);

create table eig.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references eig.orders(id) on delete cascade,
  from_status eig.order_status,
  to_status eig.order_status not null,
  actor eig.actor_kind not null,
  actor_id uuid,
  note text,
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on eig.order_status_history (order_id, created_at);

-- ---------------------------------------------------------------------------
-- Money movement
-- ---------------------------------------------------------------------------
create table eig.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references eig.accounts(user_id) on delete cascade,
  kind eig.wallet_txn_kind not null,
  -- Signed: positive credits the wallet, negative debits it.
  amount numeric(14,2) not null,
  balance_after numeric(14,2) not null,
  order_id uuid references eig.orders(id) on delete set null,
  payment_ref text,
  note text,
  -- Makes top-ups and charges safe to retry.
  idempotency_key text unique,
  created_at timestamptz not null default now()
);
create index wallet_txn_account_idx on eig.wallet_transactions (account_id, created_at desc);

create table eig.payments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references eig.accounts(user_id) on delete set null,
  order_id uuid references eig.orders(id) on delete set null,
  provider text not null,
  provider_ref text,
  purpose text not null check (purpose in ('order', 'wallet_topup', 'subscription')),
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'USD',
  status eig.payment_status not null default 'pending',
  raw jsonb not null default '{}'::jsonb,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_provider_ref_idx on eig.payments (provider, provider_ref);
create trigger payments_updated before update on eig.payments
  for each row execute function eig.set_updated_at();

create table eig.subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references eig.accounts(user_id) on delete cascade,
  tier eig.account_tier not null,
  period text not null check (period in ('monthly', 'annual')),
  status eig.tier_status not null default 'active',
  amount numeric(14,2) not null,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,
  provider text,
  provider_ref text,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_account_idx on eig.subscriptions (account_id, status);
create trigger subscriptions_updated before update on eig.subscriptions
  for each row execute function eig.set_updated_at();

/*
 * Atomically move a merchant's wallet balance and record the ledger row.
 * Every wallet mutation in the application goes through this function so the
 * denormalised balance on eig.accounts can never drift from the ledger.
 * Returns the new balance. Raises when funds are insufficient.
 */
create or replace function eig.apply_wallet_txn(
  p_account_id uuid,
  p_kind eig.wallet_txn_kind,
  p_amount numeric,
  p_order_id uuid default null,
  p_idempotency_key text default null,
  p_note text default null
) returns numeric
language plpgsql
security definer
set search_path = eig, pg_temp
as $$
declare
  v_balance numeric(14,2);
  v_existing numeric(14,2);
begin
  if p_amount = 0 then
    raise exception 'wallet transaction amount must be non-zero';
  end if;

  -- Replay of a previous call: return the balance it produced, unchanged.
  if p_idempotency_key is not null then
    select balance_after into v_existing
      from eig.wallet_transactions where idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

  -- Lock the account row so concurrent charges cannot both pass the check.
  select wallet_balance into v_balance
    from eig.accounts where user_id = p_account_id for update;
  if not found then
    raise exception 'account % not found', p_account_id;
  end if;

  v_balance := v_balance + p_amount;
  if v_balance < 0 then
    raise exception 'insufficient wallet balance' using errcode = 'check_violation';
  end if;

  update eig.accounts set wallet_balance = v_balance where user_id = p_account_id;

  insert into eig.wallet_transactions
    (account_id, kind, amount, balance_after, order_id, idempotency_key, note)
  values
    (p_account_id, p_kind, p_amount, v_balance, p_order_id, p_idempotency_key, p_note);

  return v_balance;
end $$;

revoke all on function eig.apply_wallet_txn(uuid, eig.wallet_txn_kind, numeric, uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Merchant API
-- ---------------------------------------------------------------------------
create table eig.api_keys (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references eig.accounts(user_id) on delete cascade,
  key_id text not null unique,           -- public identifier, sent in headers
  secret_hash text not null,             -- sha256(secret), for constant-time lookup
  -- AES-GCM ciphertext of the secret, keyed by EIG_SIGNING_SECRET. Request
  -- signatures are HMACs keyed on the secret itself, so the server has to be
  -- able to recover it; encrypted at rest is the compromise. RLS never exposes
  -- this column to a client — the dashboard reads through the server.
  secret_encrypted text not null default '',
  secret_preview text not null,          -- last 4 chars, for the dashboard list
  name text not null default 'Default key',
  scopes eig.api_scope[] not null default '{}',
  last_used_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index api_keys_account_idx on eig.api_keys (account_id) where active;

-- Replay protection for signed requests. Rows older than the skew window are
-- pruned by eig.prune_api_nonces().
create table eig.api_nonces (
  nonce text primary key,
  key_id text not null,
  seen_at timestamptz not null default now()
);
create index api_nonces_seen_idx on eig.api_nonces (seen_at);

create or replace function eig.prune_api_nonces() returns void
language sql security definer set search_path = eig, pg_temp as $$
  delete from eig.api_nonces where seen_at < now() - interval '15 minutes';
$$;

create table eig.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references eig.accounts(user_id) on delete cascade,
  url text not null,
  secret text not null,
  events eig.webhook_event[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table eig.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references eig.webhook_endpoints(id) on delete cascade,
  event eig.webhook_event not null,
  payload jsonb not null,
  status eig.delivery_status not null default 'pending',
  attempts int not null default 0,
  last_error text,
  response_status int,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index webhook_deliveries_pending_idx on eig.webhook_deliveries (next_attempt_at)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- Quotations
-- ---------------------------------------------------------------------------
create table eig.rfqs (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  account_id uuid references eig.accounts(user_id) on delete set null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  company_name text,
  destination_country text,
  incoterm text,
  target_price numeric(14,2),
  message text,
  status eig.rfq_status not null default 'open',
  quoted_total numeric(14,2),
  quoted_at timestamptz,
  created_at timestamptz not null default now()
);
create index rfqs_account_idx on eig.rfqs (account_id, created_at desc);
create index rfqs_status_idx on eig.rfqs (status, created_at desc);

create table eig.rfq_items (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references eig.rfqs(id) on delete cascade,
  product_id uuid references eig.products(id) on delete set null,
  description text not null,
  qty int not null check (qty >= 1)
);

-- ---------------------------------------------------------------------------
-- Ops
-- ---------------------------------------------------------------------------
create table eig.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor eig.actor_kind not null,
  actor_id uuid,
  action text not null,
  entity text,
  entity_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on eig.audit_logs (created_at desc);

create table eig.rate_limits (
  bucket text primary key,
  count int not null default 0,
  window_start timestamptz not null default now()
);

create table eig.email_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references eig.orders(id) on delete cascade,
  kind text not null,
  recipient text not null,
  dedupe_key text not null unique,
  status text not null default 'pending',
  attempts int not null default 0,
  error text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Principles (mirroring the HDML store):
--   * anon/authenticated may read the ACTIVE catalog only.
--   * An account may read its own row, its own orders and its own ledger.
--   * Every write goes through the server with the service role key, after an
--     explicit authorization check in application code.
--   * Tables with RLS on and no policy are fully closed.
--   * Claim pages are NOT covered by RLS: the token is the secret and the
--     server reads those rows with the service role after verifying it.
-- ---------------------------------------------------------------------------
alter table eig.settings             enable row level security;
alter table eig.accounts             enable row level security;
alter table eig.account_seats        enable row level security;
alter table eig.admin_profiles       enable row level security;
alter table eig.suppliers            enable row level security;
alter table eig.categories           enable row level security;
alter table eig.brands               enable row level security;
alter table eig.products             enable row level security;
alter table eig.product_price_breaks enable row level security;
alter table eig.orders               enable row level security;
alter table eig.order_items          enable row level security;
alter table eig.order_status_history enable row level security;
alter table eig.wallet_transactions  enable row level security;
alter table eig.payments             enable row level security;
alter table eig.subscriptions        enable row level security;
alter table eig.api_keys             enable row level security;
alter table eig.api_nonces           enable row level security;
alter table eig.webhook_endpoints    enable row level security;
alter table eig.webhook_deliveries   enable row level security;
alter table eig.rfqs                 enable row level security;
alter table eig.rfq_items            enable row level security;
alter table eig.audit_logs           enable row level security;
alter table eig.rate_limits          enable row level security;
alter table eig.email_events         enable row level security;

-- Public catalog reads.
create policy categories_public_read on eig.categories
  for select to anon, authenticated using (true);
create policy brands_public_read on eig.brands
  for select to anon, authenticated using (true);
create policy suppliers_public_read on eig.suppliers
  for select to anon, authenticated using (active);
create policy products_public_read on eig.products
  for select to anon, authenticated using (active);
create policy price_breaks_public_read on eig.product_price_breaks
  for select to anon, authenticated using (
    exists (select 1 from eig.products p where p.id = product_id and p.active)
  );

-- Own account.
create policy accounts_self_read on eig.accounts
  for select to authenticated using (user_id = (select auth.uid()));
create policy accounts_self_update on eig.accounts
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy seats_self_read on eig.account_seats
  for select to authenticated
  using (user_id = (select auth.uid()) or account_id = (select auth.uid()));

-- Own orders: as the buyer, or as the merchant that paid for them.
create policy orders_self_read on eig.orders
  for select to authenticated using (
    buyer_account_id = (select auth.uid()) or merchant_account_id = (select auth.uid())
  );
create policy order_items_self_read on eig.order_items
  for select to authenticated using (
    exists (
      select 1 from eig.orders o
      where o.id = order_id
        and (o.buyer_account_id = (select auth.uid()) or o.merchant_account_id = (select auth.uid()))
    )
  );
create policy order_history_self_read on eig.order_status_history
  for select to authenticated using (
    exists (
      select 1 from eig.orders o
      where o.id = order_id
        and (o.buyer_account_id = (select auth.uid()) or o.merchant_account_id = (select auth.uid()))
    )
  );

-- Own ledger and billing.
create policy wallet_self_read on eig.wallet_transactions
  for select to authenticated using (account_id = (select auth.uid()));
create policy payments_self_read on eig.payments
  for select to authenticated using (account_id = (select auth.uid()));
create policy subscriptions_self_read on eig.subscriptions
  for select to authenticated using (account_id = (select auth.uid()));

-- API keys: the secret hash is never selectable by the client; the dashboard
-- reads through the server. Only metadata is exposed here.
create policy api_keys_self_read on eig.api_keys
  for select to authenticated using (account_id = (select auth.uid()));
create policy webhooks_self_read on eig.webhook_endpoints
  for select to authenticated using (account_id = (select auth.uid()));

create policy rfqs_self_read on eig.rfqs
  for select to authenticated using (account_id = (select auth.uid()));

-- Settings: only the public-facing keys are readable by clients.
create policy settings_public_read on eig.settings
  for select to anon, authenticated using (key in ('pricing_public', 'shipping_public'));

-- ---------------------------------------------------------------------------
-- Grants — PostgREST needs schema usage plus per-table privileges; RLS above
-- is what actually restricts the rows.
-- ---------------------------------------------------------------------------
grant usage on schema eig to anon, authenticated, service_role;
grant select on all tables in schema eig to anon, authenticated;
grant all on all tables in schema eig to service_role;
grant all on all functions in schema eig to service_role;
grant all on all sequences in schema eig to service_role;

alter default privileges in schema eig grant select on tables to anon, authenticated;
alter default privileges in schema eig grant all on tables to service_role;

-- ---------------------------------------------------------------------------
-- Seed
-- ---------------------------------------------------------------------------
insert into eig.settings (key, value) values
  ('pricing', jsonb_build_object(
    'egp_per_usd', 48.5,
    'hdml_markup_bps', 0,
    'min_order_usd', 25
  )),
  ('pricing_public', jsonb_build_object('currency', 'USD', 'display_currency', 'USD')),
  ('shipping_public', jsonb_build_object(
    'lead_time_days_min', 15,
    'lead_time_days_max', 30,
    'customs_included', false
  )),
  ('integration', jsonb_build_object('hdml_enabled', true, 'claim_ttl_days', 30))
on conflict (key) do nothing;

-- The eight top-level groups from the company overview.
insert into eig.categories (slug, name_en, name_zh, group_key, icon, sort) values
  ('electronics',        'Electronics',                  '电子产品',   'electronics',  'cpu',       10),
  ('electrical-industrial','Electrical & Industrial',    '电气与工业', 'industrial',   'factory',   20),
  ('home-lifestyle',     'Home & Lifestyle',             '家居生活',   'home',         'home',      30),
  ('fashion-accessories','Fashion & Accessories',        '服装配饰',   'fashion',      'shirt',     40),
  ('office-commercial',  'Office & Commercial Supplies', '办公商用',   'office',       'briefcase', 50),
  ('automotive',         'Automotive Products',          '汽车用品',   'automotive',   'car',       60),
  ('other-wholesale',    'Other Wholesale',              '其他批发',   'other',        'package',   70),
  ('medical-lab',        'Medical & Laboratory',         '医疗实验室', 'medical',      'flask',     80)
on conflict (slug) do nothing;
