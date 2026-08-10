# ELECT-I Global

B2B wholesale platform at **elect-i-global.com**. Second app in the HDML
monorepo: its own Next.js 16 app and Cloudflare Worker, sharing the HDML
Supabase project through a dedicated `eig` Postgres schema.

> **Status: feature-complete, not yet deployed.** Every surface is built and
> `npm run eig:build` passes clean (42 routes). The Supabase migrations have
> **not been applied** and nothing is deployed yet — see
> [Going live](#going-live). The payment gateway runs on the mock provider
> until a real merchant entity + Paymob keys exist.

```bash
npm run eig:dev        # from the repo root — dev server on :3001
npm run eig:build
npm run eig:typecheck
npm run eig:deploy     # Cloudflare Worker "elect-i-global"
```

## Architecture

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2 App Router, TypeScript, Tailwind v4 |
| Hosting | Cloudflare Workers via `@opennextjs/cloudflare` |
| Data | The HDML Supabase project, `eig` schema only (`db: { schema: "eig" }`) |
| Money | Integer **USD cents** via `src/lib/money.ts`; DB stores `numeric(14,2)` |
| i18n | `en` + `zh` under `/[lang]`, dictionaries in `src/i18n/dictionaries/` |
| Payments | Provider abstraction; `mock` by default, Paymob adapter behind env |

Run `supabase/migrations/0007_eig_init.sql` (repo root), then add **`eig`** to
Supabase → Settings → API → Exposed schemas. Nothing here touches `public.*`.

## Non-negotiable conventions

1. **Next 16**: `params`/`searchParams`/`cookies()`/`headers()` are async.
   `PageProps<"/[lang]/x">`, `LayoutProps`, `RouteContext` are global types —
   never import them. No `use cache`/ISR. Docs live in
   `node_modules/next/dist/docs/`. Middleware stays `middleware.ts` (the
   OpenNext adapter does not support Node `proxy.ts` yet) despite the
   deprecation warning.
2. **Money** only through `src/lib/money.ts`. Convert DB values with
   `toCents(String(value))`, render with `formatUsd()`. Never float math.
3. **Supabase**: `await supabaseServer()` is RLS-scoped; `supabaseService()`
   **bypasses RLS** — every call site authorizes first. Return types are
   inferred deliberately; annotating them as `SupabaseClient` re-widens the
   schema generic back to `public` and defeats the `eig` pinning.
4. **Never trust client prices or tiers.** `priceItems()` reprices every
   catalog line from the DB at the tier resolved server-side. Only lines with
   no catalog match may carry a caller price, and they are flagged `is_custom`.
5. **`server-only` modules** (`catalog.ts`, `orders.ts`, `claim.ts`, …) must
   not be imported for runtime values by client components. Shared constants
   and types live in `src/lib/catalog-shared.ts`.
6. **Colour semantics**: amber `verify-*` is verification ONLY, green
   `settled-*` is money, cyan `accent-*` is brand. Do not cross them.

## Honesty constraints (read before writing any copy)

The source company profile labelled its leadership, registration numbers,
incorporation details and founding year as **fictional placeholders**. Real
buyers make payment decisions on these pages, so:

- `src/config/company.ts` is the only source of identity. Registration
  numbers, tax IDs, a street address, executives and a founding year are
  **empty** and must stay empty until real ones exist. `hasLegalEntity`,
  `hasOffice` and `hasCredentials` gate those blocks — absent, never a
  "coming soon" placeholder.
- `company.capabilities` flags (inspections, factory audits, escrow, supplier
  verification) are all `false`. Describe them as services that can be
  *coordinated*, never as already performed or verified.
- The footer carries `company.operator.disclosure`: ELECT-I Global is a
  trading name operated by HDML (Egypt), which is the seller of record. Terms
  and About must stay consistent with that.

## The prepaid claim flow

The reason this platform exists.

1. A Merchant/Elite account creates an order **on behalf of** a customer and
   pays from their wallet or credit line — no address collected.
2. The order lands in `awaiting_recipient` with a 32-byte CSPRNG claim token.
3. The recipient opens `/[lang]/claim/<token>` and must type the **upstream
   order reference** (e.g. HDML's `I20260713175900`). Rate-limited 8 attempts
   / 15 min per token, compared in constant time; success sets a signed
   httpOnly cookie.
4. The page leads with **Amount due $0.00 — paid in full by <merchant>**, then
   a verification panel comparing the upstream snapshot against what ELECT-I
   will ship, sealed by two independently computed HMAC digests
   (`external_digest` vs `items_digest`).
5. **On digest mismatch the form is withheld entirely** — the recipient is
   told to contact support rather than shown a warning they might skip.
6. One screen of delivery details, autosaved on a debounce, then
   `claimed` → `ready_to_ship` and an `order.claimed` webhook.

## Merchant API

`POST /api/v1/orders`, `GET /api/v1/orders`, `GET /api/v1/orders/:id`,
`POST /api/v1/orders/:id/cancel`, `GET /api/v1/wallet`.

Headers: `X-EIG-Key-Id`, `X-EIG-Timestamp`, `X-EIG-Nonce`, `X-EIG-Signature`.
Signature is hex HMAC-SHA256 over `${timestamp}\n${METHOD}\n${path}\n${nonce}\n${body}`
keyed on **that merchant's own secret**. 300s skew window; the nonce is
inserted into `eig.api_nonces` so its primary key rejects replays.

Secrets are stored **AES-GCM encrypted** (`api_keys.secret_encrypted`, KEK
derived from `EIG_SIGNING_SECRET`) because HMAC verification needs to recover
them; `secret_hash` is kept as a cross-check.

Webhooks: `order.created|claimed|shipped|delivered|cancelled`,
`wallet.low_balance`. Queued to `eig.webhook_deliveries`, signed with the
endpoint's own secret, exponential backoff, 6 attempts. Drive retries by
POSTing `/api/cron/webhooks` with `Authorization: Bearer $CRON_SECRET`.

## Wallet integrity

Every balance change goes through `eig.apply_wallet_txn()`, which locks the
account row, writes the ledger entry and the denormalised balance together,
and returns the prior result on a repeated `idempotency_key`. Never write
`accounts.wallet_balance` directly.

## What's built

| Area | State |
|---|---|
| Scaffold, brand system, logo, i18n (EN + ZH) | **Done** |
| `eig` schema migration (`0007`) | **Done** — not yet applied |
| Money / tiers / auth / crypto / rate-limit libs | **Done** |
| Home page (canvas trade globe, bento, tiers) | **Done** |
| Catalog / category / product / suppliers pages + seed script | **Done** |
| Prepaid claim flow | **Done** |
| Merchant API + webhooks + payment abstraction (mock + Paymob) | **Done** |
| Auth (login / register / forgot / confirm / update-password) | **Done** |
| Account pages | **Done** |
| Merchant dashboard (overview / on-behalf / orders / wallet / api / team / settings) | **Done** |
| `/pay/return` payment landing (with mock-settle) | **Done** |
| Marketing pages (about / services / membership / contact / quote / developers / suppliers/apply) | **Done** |
| Legal pages (terms / privacy / returns / compliance / IP / shipping / payments) | **Done** |
| HDML → ELECT-I integration (`0008` + `src/lib/eig/`) | **Done** — see `docs/EIG-INTEGRATION.md` |
| Admin area | **Not built** (orders are visible to the account that owns them via the dashboard; a dedicated ops admin is future work) |

## Going live

1. Apply `supabase/migrations/0007_eig_init.sql` and `0008_hdml_eig_link.sql`,
   then add **`eig`** to Supabase → Settings → API → Exposed schemas.
2. Set the Worker secrets from `.env.example` (`openssl rand -hex 32` for the
   two HMAC secrets), keeping `PAYMENT_PROVIDER=mock` until a real merchant
   entity and Paymob keys exist.
3. `npm run eig:seed` to populate the catalog (9k HDML mirror + curated).
4. `npm run eig:deploy`, point `elect-i-global.com` at the Worker.
5. Wire HDML → ELECT-I per `docs/EIG-INTEGRATION.md` (shared `EIG_CLAIM_SECRET`
   and EGP→USD rate on both sides).

## Environment

See `.env.example`. Secrets go to Worker secrets, never the repo:
`SUPABASE_SERVICE_ROLE_KEY`, `EIG_SIGNING_SECRET`, `EIG_CLAIM_SECRET`,
`CRON_SECRET`, and the `PAYMOB_*` set once the live gateway is switched on.
Generate the HMAC secrets with `openssl rand -hex 32`.
