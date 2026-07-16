-- HDML Wholesale Store — 0003_storage
-- Storage buckets. Payment proofs and invoices are PRIVATE — no read policies;
-- the server issues short-lived signed URLs after authorization checks.
-- Product images and site assets (logo, payment QR) are public-read.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('invoices',       'invoices',       false, 10485760, array['application/pdf']),
  ('product-images', 'product-images', true,  5242880, array['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('site-assets',    'site-assets',    true,  5242880, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do nothing;

-- Public read for the two public buckets (uploads remain service-role only:
-- no insert/update/delete policies are created for client roles).
create policy "public read product images" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

create policy "public read site assets" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'site-assets');

-- payment-proofs and invoices: NO policies — closed to anon/authenticated.
-- All access happens through the service role (signed URLs / server uploads).
