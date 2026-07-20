-- 0006_checkout_shipping.sql
-- Checkout restructure (2026-07-20)
--
-- The buying flow changes: customers no longer enter contact/delivery details
-- at checkout. Name + email come from their account, they may only add a note
-- and pick a payment method. After the admin VERIFIES the payment, an email
-- link sends them to an EXTERNAL platform to confirm the order and enter their
-- shipping details (no shipping is collected on this site).
--
-- Consequences:
--   * orders.phone / governorate / address become nullable (never collected here)
--   * orders.shipping_submitted_at added (reserved; unused now that shipping is
--     handled off-site)
--   * a "bank" payment kind + per-method min_order_egp let a CIB bank-transfer
--     option appear only for large orders (>= EGP 70,000)

alter table public.orders
  alter column phone drop not null,
  alter column governorate drop not null,
  alter column address drop not null;

alter table public.orders
  add column if not exists shipping_submitted_at timestamptz;

-- NOTE: `alter type ... add value` cannot be used in the same transaction that
-- also INSERTs a row using the new value. The bank payment_methods row is
-- therefore seeded in a separate statement (see below / run after commit).
alter type public.payment_kind add value if not exists 'bank';

alter table public.payment_methods
  add column if not exists min_order_egp integer not null default 0;

-- Seed the CIB bank-transfer method (run as a separate statement after the
-- enum change has committed):
--
-- insert into public.payment_methods
--   (kind, label, number, display_name, instructions, active, sort, min_order_egp)
-- select 'bank', 'Bank transfer (CIB)', '100070715613', 'Ahmed Tarek Fawzy',
--        'Bank: CIB  ·  IBAN: EG610010005700000100070715613  ·  Available for orders of EGP 70,000 and above.',
--        true, 100, 70000
-- where not exists (select 1 from public.payment_methods where kind = 'bank');
