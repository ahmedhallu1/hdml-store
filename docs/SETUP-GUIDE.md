# HDML Store — Status & Notes

## 🎉 Your store is LIVE

**https://hdml-store.hdml.workers.dev**

Everything is deployed, tested end-to-end on the live site, and working:
~8,700 active products with branded per-category images, ordering, Instapay/
wallet payment + QR, screenshot upload, the admin panel, PDF receipts, email
(welcome-on-signup + receipts), reliable password reset, and Cloudflare
Turnstile bot protection.

---

## 1. Log into your admin account  ⏱️ 1 min

Password reset now works reliably (emails go out through Brevo, not Supabase).

**I've emailed you a “Set your HDML admin password (updated link)” email** —
open it, click **Set your password**, choose a password, and you're in. Then
open **https://hdml-store.hdml.workers.dev/admin**.

> If that email got buried, just go to
> https://hdml-store.hdml.workers.dev/login → **Forgot password?** →
> `ahmedthalool0@gmail.com` → a fresh link arrives in seconds.

*(The earlier "Set your HDML admin password" email had a broken link — ignore
it and use the newer "(updated link)" one.)*

---

## 2. Keep Brevo emails flowing  ⏱️ 1 min (recommended)

Brevo can block API calls from unfamiliar IPs. Cloudflare uses many IPs, so if
receipts ever stop arriving:

1. Open **https://app.brevo.com/security/authorised_ips**
2. Make sure the authorised-IPs restriction is **off**.

Also confirm `ahmedthalool0@gmail.com` is a **verified sender** (Settings →
Senders). Emails are sending fine right now, so this is just insurance.

---

## 3. Instapay QR (optional)

The Instapay payment shows your InstaPay address **`ahmedhallulcib@instapay`**
plus an auto-generated QR of that address. If you want your **exact official
InstaPay QR image** on the page instead (more reliable to scan), upload it in
**Admin → Settings → Payment methods → Instapay → QR image**. The address text
always works regardless.

---

## ✅ Bot protection (Turnstile) — DONE

Real Cloudflare Turnstile is live on registration, checkout and proof upload.
No test keys anywhere. Nothing to do here.

---

## ⚠️ Rotate your keys — recommended soon

Your Supabase service-role key and Brevo key were exposed in two ways: pasted
into our chat, and briefly baked into the Cloudflare build output that got
committed to the (private) GitHub repo. **I've already removed them from GitHub**
— untracked the build folder and scrubbed it from all git history (force-pushed
clean) — but because plaintext copies existed, best practice is to rotate them:

- Supabase → **Settings → API → Reset `service_role` key**
- Brevo → **SMTP & API → API Keys** → delete the old key, **generate a new one**
- (Optional) Cloudflare → **Turnstile** → your widget → **Rotate secret**

Then put the new values in `.env.local`, run
`npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`,
`npx wrangler secret put BREVO_API_KEY`
(and `TURNSTILE_SECRET_KEY` if you rotated it), pasting each when asked, then
`npm run deploy`. Or just send word and I'll walk through it with you — the app
keeps running on the current keys until you do.

> The `.open-next/` build folder is now git-ignored, so future deploys can't
> leak env values again.

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
