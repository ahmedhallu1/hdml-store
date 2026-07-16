-- HDML Wholesale Store — 0004_seed
-- Initial categories, payment methods, and site settings.
-- Idempotent: safe to re-run (upserts by natural key).

-- ---------------------------------------------------------------------------
-- Categories (icon = key used by the HDML placeholder image system)
-- ---------------------------------------------------------------------------
insert into public.categories (slug, name, icon, sort) values
  ('cases-protection',     'Phone Cases & Protection',  'case',      10),
  ('chargers-power',       'Chargers & Power',          'charger',   20),
  ('earbuds-headphones',   'Earbuds & Headphones',      'earbuds',   30),
  ('cables-adapters',      'Cables & Adapters',         'cable',     40),
  ('computer-peripherals', 'Computer Peripherals',      'keyboard',  50),
  ('speakers-audio',       'Speakers & Audio',          'speaker',   60),
  ('storage-memory',       'Storage & Memory',          'storage',   70),
  ('phone-accessories',    'Phone Accessories',         'phone',     80),
  ('networking',           'Networking',                'router',    90),
  ('smartphones',          'Smartphones',               'phone',    100),
  ('tablets-ereaders',     'Tablets & E-readers',       'tablet',   110),
  ('computers',            'Computers',                 'computer', 120),
  ('wearables',            'Smart Watches & Wearables', 'watch',    130),
  ('cameras-photography',  'Cameras & Photography',     'camera',   140),
  ('tv-video',             'TV & Video',                'tv',       150),
  ('gaming',               'Gaming',                    'gamepad',  160),
  ('batteries',            'Batteries',                 'battery',  170),
  ('smart-home',           'Smart Home & Gadgets',      'smarthome',180),
  ('laptops-bags',         'Laptop Bags & Backpacks',   'bag',      190),
  ('other',                'Other',                     'box',      200)
on conflict (slug) do update
  set name = excluded.name, icon = excluded.icon, sort = excluded.sort;

-- ---------------------------------------------------------------------------
-- Payment methods (numbers provided by the owner, 2026-07-16)
-- ---------------------------------------------------------------------------
insert into public.payment_methods (kind, label, number, display_name, instructions, active, sort)
select v.kind::public.payment_kind, v.label, v.number, v.display_name, v.instructions, true, v.sort
from (values
  ('instapay', 'Instapay', '01099019374', 'Ahmed T**** F*****',
   'Send the exact total to this number via Instapay. The recipient name shown should be "Ahmed T**** F*****". Put your order reference in the transfer note.', 10),
  ('wallet', 'Mobile Wallet 1', '01099019374', 'Ahmed T',
   'Send the exact total to this wallet number. The recipient name shown should be "Ahmed T".', 20),
  ('wallet', 'Mobile Wallet 2', '01031337325', 'Ahmed T',
   'Send the exact total to this wallet number. The recipient name shown should be "Ahmed T".', 30),
  ('wallet', 'Mobile Wallet 3', '01031334520', 'Ahmed T',
   'Send the exact total to this wallet number. The recipient name shown should be "Ahmed T".', 40)
) as v(kind, label, number, display_name, instructions, sort)
where not exists (
  select 1 from public.payment_methods pm
  where pm.number = v.number and pm.kind = v.kind::public.payment_kind
);

-- ---------------------------------------------------------------------------
-- Site settings
-- ---------------------------------------------------------------------------
insert into public.site_settings (key, value) values
  ('seller_info', jsonb_build_object(
     'name', 'Ahmed Tarek Hallul',
     'tax_id', '777796066',
     'address', 'Egypt, Damanhour, Esmail Elhaddad St, 22512'
  )),
  ('delivery', jsonb_build_object(
     'message', 'Thank you for ordering from us, the shipment will be delivered within 5 working days.',
     'regions', 'All Egypt',
     'time', '5 working days',
     'fee_note', 'Shipping is confirmed with you after order review; no online shipping fee is charged.'
  )),
  ('ordering', jsonb_build_object(
     'min_order_egp', 1000,
     'currency', 'EGP',
     'vat_note', 'Prices are final (VAT inclusive).'
  )),
  ('contact', jsonb_build_object(
     'phone', '01099019374',
     'whatsapp', '01099019374',
     'email', 'ahmedthalool0@gmail.com',
     'facebook', '',
     'instagram', ''
  )),
  ('branding', jsonb_build_object(
     'store_name', 'HDML',
     'tagline', 'Wholesale Electronics & Accessories',
     'primary_color', '#004754'
  ))
on conflict (key) do nothing;
