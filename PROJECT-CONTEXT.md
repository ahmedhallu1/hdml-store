# HDML Store — Project Context

Wholesale electronics ecommerce for **HDML** (Egypt). Customers browse a
~9,000-product catalog, order in bulk, pay manually via **Instapay / mobile
wallet**, upload a transfer screenshot, and receive PDF receipts by email after
the owner verifies the payment. 100% free-tier stack.

## Stack & deployment

- **Next.js 16.2 App Router + TypeScript + Tailwind v4** (src dir, `@/*` alias)
- **Cloudflare Workers** via `@opennextjs/cloudflare` (`npm run preview` / `deploy`)
- **Supabase** free tier: Postgres (+RLS), Auth (customers & admin), Storage
- **Brevo** free tier for transactional email (REST API, no SDK)
- **Cloudflare Turnstile** on register/checkout/proof-upload
- No paid services or gateways. No new npm deps without strong justification.

## Non-negotiable conventions

1. **Next 16 rules**: `cookies()`/`headers()`/`params`/`searchParams` are
   ASYNC (`await props.params`). Auth gating lives in `src/middleware.ts` (edge — the OpenNext Cloudflare adapter does not support Node `proxy.ts` yet).
   `revalidateTag(tag, "max")` needs a profile; prefer `updateTag`/`refresh`
   in server actions. Docs live in `node_modules/next/dist/docs/`.
2. **Money**: integer piasters via `src/lib/money.ts` ONLY. DB stores
   numeric(12,2). Convert with `toPiasters(String(dbValue))`, render with
   `formatEgp()`. Never trust client-sent prices/totals — recompute
   server-side from DB.
3. **Supabase clients** (`src/lib/supabase/server.ts`):
   `await supabaseServer()` = cookie/RLS-scoped;
   `supabaseService()` = service role, BYPASSES RLS — every call site must do
   its own authorization first (`requireUser`/`requireAdmin` from
   `src/lib/auth.ts`). Client components use `supabaseBrowser()`.
4. **Validation**: every server action / route handler parses input with the
   zod schemas in `src/lib/validation.ts` (extend there). Rate-limit public
   endpoints with `rateLimit()` and verify Turnstile with `verifyTurnstile()`.
5. **Order status flow**: awaiting_payment → awaiting_verification (proof
   uploaded) → paid (admin approval ONLY) → fulfilled; cancellable until paid.
   Transitions validated against `ORDER_TRANSITIONS` and recorded in
   `order_status_history`. Uploading a proof NEVER means paid — copy must say
   "pending manual verification".
6. **Files**: payment proofs & invoice PDFs live in PRIVATE buckets
   (`payment-proofs`, `invoices`); serve via short-lived signed URLs
   (`createSignedUrl(path, 600)`) after ownership checks. Product images are
   public bucket `product-images`; placeholders via `<ProductPlaceholder icon>`.
7. **UI**: components in `src/components/ui/` (Button, TextField, SelectField,
   TextAreaField, Badge, OrderStatusBadge, StockBadge, Spinner, PageLoading,
   Dialog). Brand teal `brand-700` (#004754) on white, gray neutrals, Inter.
   Mobile-first, accessible labels, visible focus. No purple gradients.
8. **Cart**: client store `src/lib/cart.tsx` (`useCart()`, localStorage);
   `CartButton` in header. Server re-fetches products and re-prices at
   checkout; MOQ + min-order (EGP 1000, from `site_settings.ordering`) are
   enforced server-side.
9. Keep pages **dynamic** (they read cookies via supabaseServer). Do not add
   `use cache`/ISR yet.

## Key schema facts (supabase/migrations/)

- `products`: sku unique (deterministic hash), slug unique, price numeric,
  stock_status enum, moq, active, needs_review/review_reason,
  images jsonb (paths in `product-images` bucket or full URLs).
- `orders`: order_ref `IYYYYMMDDHHMMSS` (see `src/lib/order-ref.ts`, generated
  server-side, unique — retry with bumpSeconds on collision),
  tracking_token (secure token used for the public tracking page `/order/[token]`),
  customer snapshot fields, subtotal/adjustment_total/total, idempotency_key
  unique (uuid from the client, one order per key).
- `order_items`: immutable snapshots (name_snapshot, sku_snapshot, unit_price,
  qty, amount, is_custom for admin-added lines like "Accessories / Service Balance").
- `payment_methods`: seeded — Instapay 01099019374 "Ahmed T**** F*****";
  wallets 01099019374 / 01031337325 / 01031334520 "Ahmed T".
- `payment_proofs`, `invoices` (unique order_id+kind: preliminary|final),
  `email_events` (dedupe_key prevents double sends), `site_settings`,
  `admin_profiles` (membership = admin), `admin_audit_logs` (log every admin
  mutation via `auditLog()`).

## Interface contracts

`src/lib/invoice-service.ts` (owner: pdf/email module) MUST export:

```ts
generateReceiptPdf(order, items, opts): Promise<Uint8Array>  // pure pdf-lib
ensureInvoice(orderId, kind): Promise<{ pdfPath: string }>   // generate+store (regenerates when kind exists)
sendOrderEmail(orderId, kind): Promise<{ sent: boolean; error?: string }>
  // kind: "preliminary" | "final"; renders template, attaches PDF, records
  // email_events with dedupe_key `order:<id>:<kind>` (attempts++ on retry),
  // returns sent:false instead of throwing when Brevo fails
getInvoiceSignedUrl(orderId, kind): Promise<string | null>
```

Consumers: checkout/proof flow calls `sendOrderEmail(id, "preliminary")` after
proof upload; admin approval calls `sendOrderEmail(id, "final")`; admin UI uses
`ensureInvoice` + `getInvoiceSignedUrl` + resend.

## Route map

- Public: `/` home, `/catalog` (search/filters/pagination), `/category/[slug]`,
  `/product/[slug]`, `/cart`, static: `/contact /delivery /privacy /returns /terms`
- Auth: `/login`, `/register` (guarded pages redirect via proxy)
- Customer: `/checkout`, `/order/[token]` (tracking, no login needed —
  token IS the secret), `/account` (profile + orders)
- Admin: `/admin` (dashboard), `/admin/products` (+`/new`, `/[id]`,
  import/export), `/admin/orders` (+`/[id]` with proof review + invoices),
  `/admin/categories`, `/admin/settings`, `/admin/audit`
- API route handlers under `src/app/api/` only where server actions don't fit
  (file upload, CSV export, cart product lookup).

## Catalog data

`data/catalog_source.csv` → `npm run import:catalog` (idempotent; audit report
at `docs/catalog-audit.md`). 9,082 products: 8,791 active, 291 inactive
needs_review (conflicting prices / mojibake / generic names).

**Live Supabase project**: `hdml-store` (ref `wdetsgxbdmldbzokqlaw`, eu-west-3).
Migrations 0001–0005 applied; catalog imported (9,082 products); owner admin account created.
Live at **https://hdml-store.hdml.workers.dev** (Cloudflare Worker `hdml-store`,
account subdomain `hdml`; secrets set via wrangler). Owner admin:
ahmedthalool0@gmail.com (password via forgot-password flow).
