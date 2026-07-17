# HDML Store — What You Need To Do

The whole app is built and your Supabase database is fully set up and secured.
There are **3 short things only you can do** — they need passwords and a login
that live only in your own accounts. After those, I do everything else (import
the 9,082 products, make you admin, test, and deploy the site) with no more
input from you.

`THIS` means: type it into the file **`.env.local`** in the project folder. That
file never leaves your computer. **Never paste a secret key into a chat.**

---

## ✅ Already done for you

- Supabase project **hdml-store** created (Paris region), database + security +
  storage + login all set up, categories / your Instapay & wallet numbers /
  seller info / delivery text loaded, and a security scan passed.
- `.env.local` already has your Supabase URL and public key filled in.

---

## Thing 1 — Supabase service-role key  ⏱️ 2 min

1. **supabase.com/dashboard** → project **hdml-store** → **Project Settings** →
   **API Keys**.
2. Find **`service_role`** → **Reveal** → **Copy**.
3. In `.env.local`, paste it after `SUPABASE_SERVICE_ROLE_KEY=`. Save.

*(This one key runs the app and lets me load the catalog.)*

---

## Thing 2 — Brevo email key  ⏱️ 3 min

Your Brevo account is ready. Just create the key:

1. **app.brevo.com** → **Settings** → **SMTP & API** → **API Keys** →
   **Generate a new API key** → copy it.
2. In `.env.local`: paste after `BREVO_API_KEY=`, and change `EMAIL_MOCK=1` to
   `EMAIL_MOCK=0`. Save.
3. Make sure your sender is confirmed: **Settings → Senders** → if
   `ahmedthalool0@gmail.com` isn't there, add it and click the email link Brevo
   sends you.

*(Skip this for now if you like — the shop still works and just logs emails
until you add the key.)*

---

## Thing 3 — Log in to Cloudflare  ⏱️ 1 min

In a terminal, in the project folder, run:

```bash
npx wrangler login
```

A browser opens — click **Allow**. That's it; I handle the rest of the deploy.

---

## Then tell me "go"

I will, with no further steps from you:

1. Import all **9,082 products** (8,791 live, 291 flagged for your review).
2. Make your account the store **admin**.
3. Run the live security + database tests.
4. Push the site to Cloudflare, set the secret keys there, and give you the live
   web address.
5. Do the small post-deploy wiring (point Supabase's login settings at the live
   address).

### One optional extra: bot protection (Turnstile)

I'll deploy with safe test protection first so the site is live fast. To turn on
real bot-blocking afterwards: **dash.cloudflare.com** → **Turnstile** → **Add
widget** (name `hdml`, mode Managed) → copy the **Site Key** and **Secret Key**,
send them to me, and I'll re-deploy with them. (Cloudflare only shows these in
the dashboard, so I can't create them for you.)

---

### The `.env.local` keys, in one place

| Line | Where it comes from | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ already filled | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ already filled | no |
| `SUPABASE_SERVICE_ROLE_KEY` | Thing 1 | **yes** |
| `BREVO_API_KEY` | Thing 2 | **yes** |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | optional Turnstile step | secret half yes |

Day-to-day admin, backups and free-tier limits: **[OPERATIONS.md](OPERATIONS.md)**.
