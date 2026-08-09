-- 0007_ordering_pause.sql
--
-- Master switch for taking orders + the waiting list it feeds.
--
-- When site_settings.ordering.accepting_orders is false the storefront stays
-- fully browsable (catalog, product pages, cart) but checkout is closed:
-- placeOrder() refuses server-side and the cart/checkout show
-- "Ordering is stopped right now" with a notify-me form. Rows land here.

create table if not exists public.reopen_notifications (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  name         text,
  phone        text,
  user_id      uuid references auth.users(id) on delete set null,
  notified_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- One live signup per address; once notified, the same person may sign up again.
create unique index if not exists reopen_notifications_email_key
  on public.reopen_notifications (lower(email)) where notified_at is null;

create index if not exists reopen_notifications_created_idx
  on public.reopen_notifications (created_at desc);

-- Service-role only, like the other owner-managed tables: the public action
-- writes through supabaseService() after Turnstile + rate limiting.
alter table public.reopen_notifications enable row level security;

-- Seed the new ordering keys onto the existing settings row. getSiteSettings()
-- merges over defaults, so an older row without them still reads as "open".
update public.site_settings
   set value = value
             || jsonb_build_object('accepting_orders', true)
             || jsonb_build_object(
                  'paused_note',
                  'We have temporarily stopped taking new orders while we clear the current backlog. Leave your email and we will let you know the moment ordering reopens.'
                ),
       updated_at = now()
 where key = 'ordering';

-- Telegram handle powering the red "contact us before paying" warning.
update public.site_settings
   set value = value || jsonb_build_object('telegram', 'ahmedhallul'),
       updated_at = now()
 where key = 'contact';
