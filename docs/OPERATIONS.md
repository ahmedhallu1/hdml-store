# HDML Store — Operations Manual

## Daily routine

1. Open **/admin** → the dashboard shows pending proofs and new orders.
2. **Proof review** (Admin → Proof review): open each screenshot, compare the
   amount and the transfer note (order reference) with your Instapay/wallet
   app, then **Approve** (order becomes Paid, final receipt emailed
   automatically) or **Reject with a reason** (customer sees it on their order
   page and can re-upload).
3. Ship paid orders; mark them **Fulfilled**.

## Email

- Every order email is logged (Admin → order → Email log) with status
  sent/failed and attempt count.
- **Retry**: Admin → order → *Resend email*. Duplicate protection is built in —
  a receipt kind that was already sent is skipped unless you explicitly resend.
- If Brevo is down or the daily quota (300/day free) is exhausted, orders keep
  working: customers download receipts from their order page; retry the email
  later.

## Backups (IMPORTANT — the Supabase free tier has NO automatic backups)

Do this **weekly** (5 minutes):

1. **Products**: Admin → Products → *Export CSV*. Keep the file.
2. **Full database dump** (needs the database password from project creation):
   Supabase dashboard → Project Settings → Database → *Connection string* (URI),
   then in a terminal:

   ```bash
   pg_dump "postgresql://postgres:YOUR_DB_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres" \
     --schema=public --no-owner --no-privileges -f hdml-backup-$(date +%Y%m%d).sql
   ```

3. **Payment proofs / invoices** (storage files): occasional export via
   Supabase dashboard → Storage → bucket → select → Download. (Invoices can
   always be regenerated from order data; proofs cannot.)

**Restore**: create a fresh Supabase project, run migrations 0001–0005, then
`psql "<connection-string>" -f hdml-backup-YYYYMMDD.sql` (it will report
harmless "already exists" notices for seeded rows), re-upload storage files,
update `.env.local` + Cloudflare secrets with the new keys, redeploy.

## Free-tier limits (honest numbers, July 2026)

| Service | Free limit | What it means for HDML | If you outgrow it |
|---|---|---|---|
| Supabase database | 500 MB | 9k products + tens of thousands of orders fit easily | Pro $25/mo |
| Supabase storage | 1 GB, 50 MB/file | ~thousands of proof screenshots (compressed ≤4 MB) | Prune old proofs or Pro |
| Supabase auth | 50,000 monthly active users | far above wholesale needs | — |
| **Supabase pausing** | **Free projects pause after ~1 week without traffic** | real visitors count as traffic; a dormant store can pause | open the dashboard to restore; visit weekly; or Pro |
| Supabase backups | none on free | see backup routine above | Pro has daily backups |
| Cloudflare Workers | 100,000 requests/day, ~10 ms CPU/request | thousands of visits/day fine; PDF generation is the heaviest step — receipts are small (1–3 pages) but very large orders could hit CPU limits | Workers Paid $5/mo (30 s CPU) |
| Brevo email | 300 emails/day, Brevo logo in footer | ≈150 orders/day (2 emails each) | Brevo Starter removes logo, raises quota |
| Turnstile | free | unlimited | — |
| workers.dev URL | free subdomain | fine to launch | buy a domain, attach in Cloudflare |

## Security notes for the owner

- Nobody can mark an order Paid except an admin account; there is a full audit
  log (Admin → Audit log) of every admin action.
- Payment screenshots and receipts are private; links generated for viewing
  expire after 10 minutes.
- If a key ever leaks: Supabase → Settings → API → *Reset service_role key*;
  Brevo → delete + regenerate API key; then update `.env.local` +
  `npx wrangler secret put …` + `npm run deploy`.

## Acceptance checklist

Customer flow:
- [ ] Home, catalog search, category and product pages load on phone + desktop
- [ ] Prices show in EGP; MOQ and tier prices apply in cart
- [ ] Register (with Turnstile), login, logout, password reset email
- [ ] Cart persists across refresh; min order EGP 1,000 enforced
- [ ] Checkout re-prices on the server; refresh/double-click cannot duplicate an order
- [ ] Order page shows exact total, Instapay + wallet numbers, QR, and the
      order reference to use as transfer note
- [ ] Screenshot upload works (JPG/PNG/WebP), status becomes *Awaiting
      Verification*, preliminary "payment pending verification" receipt arrives
- [ ] Tracking link from the email opens the order without login

Admin flow:
- [ ] /admin hidden from non-admins (404), dashboard stats correct
- [ ] Proof approve → order Paid + final PDF receipt emailed
- [ ] Proof reject with reason → customer sees it and can re-upload
- [ ] Product edit, deactivate, needs-review queue, CSV export/import
- [ ] Custom line item (e.g. "Accessories / Service Balance") recalculates totals
- [ ] Invoice preview/regenerate/resend; email log with retry
- [ ] Settings: payment numbers, seller info, delivery text, min order editable
- [ ] Audit log records every admin action

Technical:
- [ ] `npm run test` green · `npm run typecheck` green
- [ ] `npm run preview` (real Workers runtime) serves the site
- [ ] RLS verified: anon cannot read inactive products, other users' orders,
      settings, proofs (tests/rls.spec)
- [ ] No secrets in the repo (`git grep -i service_role` finds only docs)
