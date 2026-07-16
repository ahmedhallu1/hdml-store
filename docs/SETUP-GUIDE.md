# HDML Store — Owner Setup Guide

Written for a non-technical owner. Follow top to bottom; each account is free.
Anything that looks like `THIS` goes into the file `.env.local` in the project
folder (copy `.env.example` to `.env.local` first and fill values in as you go).

**Never paste the service-role key, API keys or passwords into chats or
emails.** They go only into `.env.local` (kept on your computer, never
uploaded) and into Cloudflare "secrets" (step 5).

---

## 1. Supabase (database, accounts, file storage) — ~10 minutes

You already have a Supabase account.

1. Go to https://supabase.com/dashboard → **New project**.
   - Name: `hdml-store` · Region: **Frankfurt (eu-central-1)** or the closest
     to Egypt offered · Generate a strong database password and save it in a
     password manager (needed only for backups).
2. Wait for the project to finish provisioning (~2 min).
3. **Run the database migrations** — left sidebar → **SQL Editor** → *New query*:
   open each file below from the project folder, paste its full contents, press
   **Run**, and confirm "Success" before the next one. **Order matters:**
   1. `supabase/migrations/0001_init.sql`
   2. `supabase/migrations/0002_rls.sql`
   3. `supabase/migrations/0003_storage.sql`
   4. `supabase/migrations/0004_seed.sql`
4. **Copy the keys** — sidebar → ⚙ **Project Settings → API**:
   - *Project URL* → `NEXT_PUBLIC_SUPABASE_URL`
   - *anon public* key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - *service_role* key (click reveal) → `SUPABASE_SERVICE_ROLE_KEY` ← **secret!**
5. **Auth URLs** — sidebar → **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` for now (you will change it to the real
     website address after step 5 below).
   - Add `http://localhost:3000/**` to *Redirect URLs*.

### Import the product catalog

In a terminal, inside the project folder:

```bash
npm install            # first time only
npm run import:catalog
```

You should see "inserted …/9082" progress and a final audit report at
`docs/catalog-audit.md`. Re-running it is safe — it never duplicates products.

### Make yourself admin

1. Start the site locally: `npm run dev` → open http://localhost:3000/register
   and create your own account (use your real email).
2. Back in the Supabase **SQL Editor**, run (replace the email):

```sql
insert into public.admin_profiles (user_id, display_name)
select id, 'Ahmed' from auth.users where email = 'ahmedthalool0@gmail.com'
on conflict (user_id) do nothing;
```

3. Refresh the site — you can now open http://localhost:3000/admin.

---

## 2. Brevo (sends the receipt emails) — ~5 minutes

1. Create a free account at https://www.brevo.com (300 emails/day free).
2. **Validate your sender address**: Settings (top-right) → **Senders, Domains
   & Dedicated IPs → Senders → Add a sender** → use
   `ahmedthalool0@gmail.com` → click the confirmation link Brevo emails you.
3. **Create an API key**: Settings → **SMTP & API → API Keys → Generate a new
   API key** → name it `hdml-store` → copy it → `BREVO_API_KEY`.
4. In `.env.local`: set `EMAIL_FROM=ahmedthalool0@gmail.com`,
   `EMAIL_FROM_NAME=HDML Store`, and **delete the `EMAIL_MOCK=1` line** (or
   set it to `0`) so real emails are sent.

> If email ever fails, orders are still recorded — customers can always
> download their receipt from their order page, and you can retry the email
> from Admin → order → *Resend email*.

---

## 3. Cloudflare account + Turnstile (bot protection) — ~5 minutes

1. Create a free account at https://dash.cloudflare.com/sign-up.
2. In the dashboard sidebar → **Turnstile → Add widget**:
   - Widget name: `hdml-store`
   - Hostnames: add `localhost` and (after step 5) your
     `….workers.dev` hostname.
   - Widget mode: **Managed**.
3. Copy the **Site Key** → `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and the
   **Secret Key** → `TURNSTILE_SECRET_KEY`.

Until you do this, the site uses Cloudflare's official *test* keys — fine
locally, not for production.

---

## 4. Try everything locally first

```bash
npm run dev
```

- Browse, search, add to cart, register, checkout.
- Open the order page: transfer instructions with your Instapay/wallet numbers
  and QR appear; upload any screenshot (JPG/PNG).
- Open `/admin` → Orders → the order → approve the proof → the order becomes
  Paid and the final receipt is emailed (or logged, if `EMAIL_MOCK=1`).

---

## 5. Deploy to the internet (Cloudflare Workers) — ~10 minutes

```bash
npx wrangler login          # opens the browser, approve access
```

Store the three secrets on Cloudflare (paste each value when prompted):

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put BREVO_API_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Store the non-secret runtime settings:

```bash
npx wrangler secret put EMAIL_FROM            # ahmedthalool0@gmail.com
npx wrangler secret put EMAIL_FROM_NAME       # HDML Store
```

Then deploy (the browser-visible `NEXT_PUBLIC_…` values are read from
`.env.local` during the build):

```bash
npm run deploy
```

The command prints your live URL, e.g. `https://hdml-store.<account>.workers.dev`.

**After the first deploy:**

1. Put the live URL into `.env.local` as `NEXT_PUBLIC_SITE_URL=https://…` and
   run `npm run deploy` again (it is baked into emails and links).
2. Supabase → Authentication → URL Configuration → set Site URL to the live
   URL and add `https://<your-url>/**` to Redirect URLs.
3. Cloudflare → Turnstile → your widget → add the `….workers.dev` hostname.
4. Open the live site, place a tiny test order, approve it in `/admin`, and
   check the email arrives with the PDF.

When you buy a real domain later: Cloudflare → Workers & Pages → hdml-store →
Settings → Domains & Routes → add the domain, then repeat 1–3 with the new URL.

---

## Environment variables reference

| Variable | Secret? | Where used | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | no | build + runtime | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no | build + runtime | Public API key (safe in browsers; RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | **YES** | server runtime | Full-access key — server only |
| `NEXT_PUBLIC_SITE_URL` | no | build + runtime | Public site URL (links in emails) |
| `BREVO_API_KEY` | **YES** | server runtime | Brevo transactional email key |
| `EMAIL_FROM` / `EMAIL_FROM_NAME` | no | server runtime | Validated sender identity |
| `EMAIL_MOCK` | no | server runtime | `1` = log emails instead of sending |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | no | build + runtime | Turnstile public key |
| `TURNSTILE_SECRET_KEY` | **YES** | server runtime | Turnstile verification key |
