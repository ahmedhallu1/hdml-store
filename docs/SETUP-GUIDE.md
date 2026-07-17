# HDML Store — What You Need To Do

Everything technical is built. This is the short list of things only **you** can
do (they need your own accounts and passwords). Do them top to bottom.

Anything like `THIS` goes into the file **`.env.local`** in the project folder —
that file stays on your computer and is never shared. **Never paste a secret key
into a chat or email.**

---

## ✅ Already done for you

- Supabase project **hdml-store** created (region: Paris — closest to Egypt).
- Database, security rules, storage, and login system fully set up.
- Product categories, your Instapay + wallet numbers, seller info and delivery
  text loaded.

You don't need to touch the Supabase dashboard except for **Step 1** below.

---

## Step 1 — Give the app your Supabase secret key  ⏱️ 2 min

This one key lets the app talk to your database.

1. Open **https://supabase.com/dashboard** → project **hdml-store**.
2. Left sidebar (bottom) → **Project Settings** → **API Keys**.
3. Find **`service_role`**, click **Reveal**, and **Copy** it.
4. Open `.env.local` in the project folder and paste it right after
   `SUPABASE_SERVICE_ROLE_KEY=` (no spaces, no quotes). Save.

Then tell me **"key is in"** — I'll load all 9,082 products and make your
account the admin. (Or run `npm run import:catalog` yourself.)

---

## Step 2 — Email receipts (Brevo)  ⏱️ 5 min

Until you do this, the shop still works — it just *logs* receipt emails instead
of sending them. Do it when you want real emails to go out.

1. Sign up free at **https://www.brevo.com** (300 emails/day free).
2. Confirm your sender: top-right **Settings** → **Senders, Domains & Dedicated
   IPs** → **Senders** → **Add a sender** → use `ahmedthalool0@gmail.com` →
   click the confirmation link Brevo emails you.
3. Get the key: **Settings** → **SMTP & API** → **API Keys** → **Generate a new
   API key** → copy it.
4. In `.env.local`: paste it after `BREVO_API_KEY=`, and change the last line to
   `EMAIL_MOCK=0`. Save.

---

## Step 3 — Bot protection (Cloudflare Turnstile)  ⏱️ 5 min

Needed before going live so bots can't spam orders. (Local testing works
without it.)

1. Create a free account at **https://dash.cloudflare.com/sign-up**.
2. Sidebar → **Turnstile** → **Add widget**. Name it `hdml`, add hostname
   `localhost` for now, mode **Managed**.
3. Copy the two keys into `.env.local`:
   - **Site Key** → `NEXT_PUBLIC_TURNSTILE_SITE_KEY=`
   - **Secret Key** → `TURNSTILE_SECRET_KEY=`
4. Delete the line `TURNSTILE_ALLOW_TEST_KEYS=1` (only for local testing).

---

## Step 4 — Put it online (Cloudflare Workers)  ⏱️ 10 min

In a terminal, inside the project folder:

```bash
npx wrangler login          # opens the browser — click Allow
```

Store your secret keys on Cloudflare (paste each value when asked — these go
straight to Cloudflare, not into any file):

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put BREVO_API_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put EMAIL_FROM          # ahmedthalool0@gmail.com
npx wrangler secret put EMAIL_FROM_NAME     # HDML Store
```

Then publish:

```bash
npm run deploy
```

It prints your live web address (like `https://hdml-store.xxxxx.workers.dev`).

**Right after the first deploy, do these three quick things:**

1. Put that address into `.env.local` as `NEXT_PUBLIC_SITE_URL=https://…` and run
   `npm run deploy` again (it's used in the receipt emails and links).
2. Supabase → **Authentication** → **URL Configuration** → set **Site URL** to
   that address and add `https://<your-address>/**` to **Redirect URLs**.
3. Cloudflare → **Turnstile** → your widget → add the `workers.dev` hostname.

Done — place a small test order and approve it in `/admin` to confirm the email
+ PDF receipt arrive.

---

## Later: a real domain

When you buy a domain: Cloudflare → **Workers & Pages** → **hdml-store** →
**Settings** → **Domains & Routes** → add it, then redo the 3 steps above with
the new address.

---

### The `.env.local` keys, in one place

| Line in `.env.local` | Where it comes from | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | already filled | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | already filled | no |
| `SUPABASE_SERVICE_ROLE_KEY` | Step 1 (Supabase → API Keys) | **yes** |
| `BREVO_API_KEY` | Step 2 (Brevo) | **yes** |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Step 3 (Turnstile) | no |
| `TURNSTILE_SECRET_KEY` | Step 3 (Turnstile) | **yes** |
| `NEXT_PUBLIC_SITE_URL` | your live address after Step 4 | no |

Backups, free-tier limits and the day-to-day admin routine are in
**[OPERATIONS.md](OPERATIONS.md)**.
