-- HDML store — 0008_hdml_eig_link
--
-- Columns on public.orders that record the ELECT-I Global order created when a
-- payment is approved here, and the claim link the buyer receives. Everything
-- is nullable and defaulted so existing orders and the whole flow keep working
-- when the ELECT-I integration is disabled.

alter table public.orders
  add column if not exists eig_order_id text,
  add column if not exists eig_order_number text,
  -- The full claim URL (elect-i-global.com/<lang>/claim/<token>). Surfaced on
  -- the tracking page and in the final receipt email.
  add column if not exists eig_claim_url text,
  -- push_pending: approved, waiting for the ELECT-I call
  -- pushed:       ELECT-I order created
  -- failed:       call failed; retry from the admin order page
  -- skipped:      integration disabled or order not eligible
  add column if not exists eig_status text
    check (eig_status in ('push_pending', 'pushed', 'failed', 'skipped')),
  add column if not exists eig_error text,
  add column if not exists eig_pushed_at timestamptz;

comment on column public.orders.eig_order_id is
  'ELECT-I Global order id created when this order was marked paid.';
comment on column public.orders.eig_claim_url is
  'Prepaid claim link the buyer uses on elect-i-global.com to enter delivery details.';
