# HDML Store — Final Steps

## 🎉 Your store is LIVE

**https://hdml-store.hdml.workers.dev**

Everything is deployed and working: all 9,082 products, ordering, payment
instructions with your Instapay/wallet numbers and QR codes, screenshot upload,
the admin panel, PDF receipts, email, and **real Cloudflare Turnstile bot
protection** (installed and verified on the live site). The full order lifecycle
was tested end-to-end (a receipt from the test run should be in your Gmail).

Only **two short dashboard settings** remain — they live behind your own
logins, so only you can flip them.

---

## 1. Let password-reset emails point at the live site  ⏱️ 2 min — do this first

Right now Supabase still thinks the site is on localhost, so sign-in recovery
links would go to the wrong place — including YOUR first login.

1. Open **supabase.com/dashboard** → project **hdml-store** →
   **Authentication** → **URL Configuration**.
2. Set **Site URL** to: `https://hdml-store.hdml.workers.dev`
3. Under **Redirect URLs**, add: `https://hdml-store.hdml.workers.dev/**`
4. Save.

**Then log yourself in** (your admin account is already created):
open https://hdml-store.hdml.workers.dev/login → **Forgot password?** →
`ahmedthalool0@gmail.com` → click the link in the email → set your password.
After that, **/admin** is yours.

---

## 2. Stop Brevo from blocking emails  ⏱️ 1 min

Brevo blocks API calls from IP addresses it hasn't seen before. Your website
runs on Cloudflare's network, which uses **many different IPs**, so this
protection would randomly block your receipt emails.

1. Open **https://app.brevo.com/security/authorised_ips**
2. Make sure the authorised-IPs restriction is **deactivated** (if there's a
   list of IPs with the feature enabled, turn the feature **off**).

Also confirm `ahmedthalool0@gmail.com` is a **verified sender**
(Settings → Senders — click the confirmation email if it's still pending).

---

## ✅ Bot protection (Turnstile) — DONE

Real Cloudflare Turnstile is live on registration, checkout and proof upload.
No test keys anywhere. Nothing to do here.

---

## ⚠️ One security chore (soon, not urgent)

The Supabase service key and Brevo key were pasted into our chat. Chat
transcripts aren't a safe permanent home for master keys, so when convenient:

- Supabase → Settings → API → **Reset service_role key**
- Brevo → SMTP & API → delete the old key, **generate a new one**

Then put the new values in `.env.local`, run
`npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` and
`npx wrangler secret put BREVO_API_KEY` (paste when asked), and `npm run deploy`.
(Or just send word and I'll walk through it with you.)

---

## Daily use

- **Admin panel**: https://hdml-store.hdml.workers.dev/admin — orders, proof
  review (approve = order Paid + final receipt emailed), products, the
  291-item "Needs review" queue, settings (payment numbers, minimum order,
  delivery text), audit log.
- **Routine, backups, free-tier limits**: see [OPERATIONS.md](OPERATIONS.md).

## When you buy a real domain

Cloudflare → **Workers & Pages** → **hdml-store** → Settings → **Domains &
Routes** → add the domain. Then tell me the domain and I'll update the site
URL, Supabase auth settings, and redeploy (or follow step 1 again plus
`NEXT_PUBLIC_SITE_URL` in `.env.local` + `npm run deploy`).
