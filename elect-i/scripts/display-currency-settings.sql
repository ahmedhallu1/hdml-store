-- ELECT-I Global — display-currency settings
--
-- RUN THIS ONCE, BY HAND, against the shared Supabase project. It is NOT a
-- migration and nothing in the app applies it.
--
-- What it does: adds `display_currency` and a `currencies` rate table to the
-- existing `eig.settings` row `pricing_public`. That row is already the only
-- pricing key RLS exposes to anon and authenticated clients
-- (policy `settings_public_read`), so no policy, grant or schema change is
-- needed — visitors can read these rates the moment they exist.
--
-- What it does NOT do: touch `pricing`, any order, payment, wallet or invoice.
-- The catalogue stays priced in USD and every stored amount keeps its own
-- currency and value. These rates change presentation only.
--
-- The app is written to work without this row: a missing `currencies` object
-- falls back to the seed rates in src/lib/currency.ts, and an unknown or
-- disabled default degrades to USD. Running it makes the rates explicit and
-- editable in /[lang]/admin/currency.
--
-- `rate` is units of that currency per 1 USD. Replace the numbers below with
-- the rates you actually want to quote before running.

begin;

update eig.settings
set
  value = value || jsonb_build_object(
    'display_currency', 'USD',
    'currencies', jsonb_build_object(
      'USD', jsonb_build_object('rate', 1,       'enabled', true),
      'EGP', jsonb_build_object('rate', 51,      'enabled', true),
      'EUR', jsonb_build_object('rate', 0.92,    'enabled', true),
      'SAR', jsonb_build_object('rate', 3.75,    'enabled', true),
      'AED', jsonb_build_object('rate', 3.6725,  'enabled', true)
    )
  ),
  updated_at = now()
where key = 'pricing_public';

-- Create the row if this database predates it.
insert into eig.settings (key, value)
select
  'pricing_public',
  jsonb_build_object(
    'currency', 'USD',
    'display_currency', 'USD',
    'currencies', jsonb_build_object(
      'USD', jsonb_build_object('rate', 1,      'enabled', true),
      'EGP', jsonb_build_object('rate', 51,     'enabled', true),
      'EUR', jsonb_build_object('rate', 0.92,   'enabled', true),
      'SAR', jsonb_build_object('rate', 3.75,   'enabled', true),
      'AED', jsonb_build_object('rate', 3.6725, 'enabled', true)
    )
  )
where not exists (select 1 from eig.settings where key = 'pricing_public');

commit;

-- Verify:
--   select value from eig.settings where key = 'pricing_public';
