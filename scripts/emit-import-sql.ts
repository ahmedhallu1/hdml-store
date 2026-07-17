/**
 * Emit the catalog import as batched SQL files (for loading via the Supabase
 * MCP connector when the service-role key isn't available locally). Reuses the
 * exact same deriveCatalog() logic as the real importer, so the result is
 * identical to `npm run import:catalog`.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, deriveCatalog } from "./import-catalog";
import { slugify } from "../src/lib/slug";
import { piastersToDecimalString, toPiasters } from "../src/lib/money";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "data/import-sql");
mkdirSync(OUT, { recursive: true });

function q(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

const raw = readFileSync(resolve(ROOT, "data/catalog_source.csv"), "utf8");
const [, ...rows] = parseCsv(raw);
const source = rows
  .filter((r) => r[0]?.trim())
  .map((r) => ({ name: r[0].trim(), priceDecimal: piastersToDecimalString(toPiasters(r[1])) }));

const audit = deriveCatalog(source);

// ── batch 00: import_batch + brands ─────────────────────────────────────────
const brandNames = [...new Set(audit.products.map((p) => p.brandName).filter(Boolean))] as string[];
const brandValues = brandNames
  .map((n) => `(${q(slugify(n, 60))}, ${q(n)})`)
  .join(",\n  ");

const head = `insert into public.import_batches (source, stats)
values ('data/catalog_source.csv', ${q(
  JSON.stringify({
    source_rows: audit.sourceRows,
    distinct_names: audit.distinctNames,
    distinct_combos: audit.distinctCombos,
    duplicates_removed: audit.exactDuplicateRowsRemoved,
    conflicting_names: audit.conflictingNames.length,
    active: audit.activeCount,
    needs_review: audit.reviewCount,
    via: "mcp_sql",
  }),
)}::jsonb)
on conflict do nothing;

insert into public.brands (slug, name) values
  ${brandValues}
on conflict (slug) do nothing;
`;
writeFileSync(resolve(OUT, "00_brands.sql"), head);

// ── product batches ─────────────────────────────────────────────────────────
const BATCH = 1000;
let fileIndex = 1;
for (let i = 0; i < audit.products.length; i += BATCH) {
  const chunk = audit.products.slice(i, i + BATCH);
  const values = chunk
    .map((p) => {
      const cat = `(select id from public.categories where slug=${q(p.categorySlug)})`;
      const brand = p.brandName
        ? `(select id from public.brands where name=${q(p.brandName)})`
        : "null";
      return `(${q(p.sku)}, ${q(p.slug)}, ${q(p.name)}, ${q(p.original_title)}, ${p.priceDecimal}, ${cat}, ${brand}, 'confirm_availability', 1, ${p.active}, ${p.needs_review}, ${p.review_reason ? q(p.review_reason) : "null"}, true, ${p.brandName !== null}, '[]'::jsonb, ${p.source_duplicate_count}, (select id from public.import_batches where source='data/catalog_source.csv' order by created_at desc limit 1))`;
    })
    .join(",\n  ");
  const sql = `insert into public.products (sku, slug, name, original_title, price, category_id, brand_id, stock_status, moq, active, needs_review, review_reason, category_inferred, brand_inferred, images, source_duplicate_count, import_batch_id) values
  ${values}
on conflict (sku) do nothing;
`;
  writeFileSync(resolve(OUT, `${String(fileIndex).padStart(2, "0")}_products.sql`), sql);
  fileIndex++;
}

console.log(
  `emitted ${fileIndex - 1} product batches + brands (${brandNames.length} brands, ${audit.products.length} products) to data/import-sql/`,
);
