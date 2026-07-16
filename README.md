# HDML Store

Wholesale electronics ecommerce for **HDML** (Egypt). ~9,000-product catalog,
bulk ordering, manual payment via **Instapay / Egyptian mobile wallets** with
screenshot verification, PDF receipts by email, and a full admin dashboard.
Runs entirely on free tiers: **Cloudflare Workers + Supabase + Brevo**.

> **New here?** The click-by-click setup instructions for a non-technical
> owner are in **[docs/SETUP-GUIDE.md](docs/SETUP-GUIDE.md)**. Operations
> (backups, email retries, free-tier limits, acceptance checklist) are in
> **[docs/OPERATIONS.md](docs/OPERATIONS.md)**. Architecture and coding
> conventions: **[PROJECT-CONTEXT.md](PROJECT-CONTEXT.md)**.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript, Tailwind v4) |
| Hosting | Cloudflare Workers via `@opennextjs/cloudflare` (free `workers.dev` URL) |
| Database / Auth / Files | Supabase Free (Postgres + RLS, email auth, private storage) |
| Email | Brevo Free (transactional API, PDF attachments) |
| Bot protection | Cloudflare Turnstile |
| PDF | `pdf-lib` (pure JS, runs on Workers) |

## How the shop works

1. Customer browses the catalog (server-side search/pagination — the 9k-product
   catalog is never shipped to the browser), fills a cart, registers, and
   places an order. The server re-fetches prices, applies wholesale tiers,
   enforces per-product MOQ and the EGP 1,000 minimum order, and creates the
   order with a unique reference like `I20260713175900`.
2. The order page shows the exact amount and the Instapay / wallet numbers
   (with QR). The customer transfers the money in their banking app, using the
   order reference as the transfer note, then uploads a screenshot.
3. The proof lands in a **private** bucket; the order becomes
   **Awaiting Verification** and a *preliminary* receipt ("payment pending
   verification") is emailed. **Uploading a screenshot never marks an order paid.**
4. The owner reviews the screenshot in `/admin`, approves or rejects it.
   Approval marks the order **Paid** and emails the *final* PDF receipt.

## Local development

```bash
npm install
cp .env.example .env.local          # fill in Supabase keys (see setup guide)
npm run dev                          # http://localhost:3000
```

Without real keys, Turnstile uses Cloudflare's always-pass test keys and
`EMAIL_MOCK=1` logs emails instead of sending them.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Unit/integration tests (Vitest) |
| `npm run e2e` | Playwright end-to-end tests (needs env + seeded DB) |
| `npm run audit:catalog` | Analyze the catalog CSV; writes `docs/catalog-audit.md` (no DB writes) |
| `npm run import:catalog` | Idempotent catalog import into Supabase |
| `npm run preview` | Production build + local **workerd** preview (real Workers runtime) |
| `npm run deploy` | Build + deploy to Cloudflare Workers |

## Catalog import

`data/catalog_source.csv` (converted from the original `amazon_products.xlsx`;
the second spreadsheet copy was verified identical and ignored) feeds
`scripts/import-catalog.ts`:

- 10,329 source rows → **9,082 products** (1,247 exact duplicates collapsed,
  count preserved per product).
- 32 names with **conflicting prices** → every variant imported separately,
  **inactive + needs review** (nothing merged silently).
- Corrupted (mojibake) and generic names (`Electronic_Cable`…) → inactive +
  needs review. Resolve them in **Admin → Products → Needs review**.
- Deterministic SKUs (`HDML-XXXXXXXX`) make re-runs idempotent: existing SKUs
  are never overwritten, so admin edits survive re-imports.
- Full audit trail: `docs/catalog-audit.md` + an `import_batches` row.

No product images are scraped or hot-linked from Amazon or anywhere else.
Until real photos are uploaded (Admin → product page), products show an
HDML-branded category placeholder that cannot be mistaken for a real photo.

## Security model (summary)

- RLS on every table; anon users read only the active catalog + active
  payment methods; customers read only their own orders/profile.
- All writes go through server code (service role) behind explicit
  authorization (`requireUser` / `requireAdmin`) and Zod validation.
- Payment proofs & invoices live in private buckets, served via 10-minute
  signed URLs after ownership checks. Uploads are verified by extension,
  MIME type, **file signature (magic bytes)** and size.
- Turnstile + database-backed rate limiting on register/login/checkout/upload.
- Totals are always recomputed server-side in integer piasters; client-sent
  prices are never trusted. Checkout is idempotent (one order per key even if
  the user retries/refreshes).
- Order references are unique in the DB; collisions retry with a bumped
  timestamp. Order tracking uses unguessable 48-hex capability tokens.
- Secrets only in `.env.local` / `wrangler secret` — never committed, never
  sent to the browser (`server-only` guards the service-role module).

## Repository map

```
supabase/migrations/   0001_init 0002_rls 0003_storage 0004_seed (run in order)
data/catalog_source.csv     canonical catalog input
scripts/import-catalog.ts   importer + audit generator
docs/                       setup guide, operations, catalog audit
src/lib/                    money (integer piasters), order-ref, slug/sku,
                            categorize, egypt, validation (zod), settings,
                            catalog queries, cart store, supabase clients,
                            auth guards, turnstile, rate-limit,
                            pdf/receipt, email/{brevo,templates}, invoice-service, qr
src/app/(store)/            home, catalog, category, product, cart, checkout,
                            login/register, account, order/[token], static pages
src/app/admin/              dashboard, orders + proof review, products (+CSV),
                            needs-review queue, taxonomy, settings, audit log
src/app/api/                cart-products, proof upload, receipt download, admin CSV/uploads
src/proxy.ts                session refresh + auth-gated routes (Next 16 proxy)
```
