/**
 * ELECT-I Global — catalog seed.
 *
 *   npm run seed:catalog          # writes to Supabase (eig schema)
 *   npm run seed:catalog:dry      # --dry-run: parses, prices, plans, writes NOTHING
 *
 * What it does
 * ------------
 *  1. Mirrors the HDML source catalog (../data/catalog_source.csv, prices in
 *     EGP) into eig.products with source='hdml_mirror'. EGP is converted to USD
 *     cents through src/lib/money.ts at the rate stored in eig.settings.pricing
 *     (egp_per_usd, default 48.5) — never a hardcoded rate, never float math.
 *  2. Generates curated wholesale listings for the other seven top-level groups
 *     (source='curated') so the catalog is not electronics-only.
 *  3. Seeds eig.suppliers, eig.brands and quantity eig.product_price_breaks, and
 *     assigns products to suppliers and categories.
 *
 * Idempotency
 * -----------
 * SKUs are EIG-XXXXXXXX, a stable FNV hash of the source row's IDENTITY (for the
 * mirror: normalized name + EGP price, so the SKU is independent of the FX rate;
 * for curated: group + template + variant). Products are upserted on the `sku`
 * conflict with ignoreDuplicates, so a second run inserts almost nothing and
 * NEVER overwrites a manual edit. Price breaks are only written for freshly
 * inserted products, so they cannot accumulate across runs.
 *
 * Dirty HDML data (mojibake names, generic underscore names, very short names,
 * Arabic text, the same name at conflicting prices, zero/garbage prices) is
 * marked needs_review=true with a review_reason and left inactive — never
 * silently imported as live, never silently dropped. Genuinely unparseable rows
 * (empty name, non-numeric price) are rejected and reported with a reason.
 *
 * Note on the Supabase client: src/lib/supabase/server.ts is `server-only` and
 * imports next/headers, so it cannot load under tsx. We build a service-role
 * client here with the SAME `db: { schema: "eig" }` pin, which is what makes
 * `.from("products")` mean `eig.products`. The return type is left inferred (per
 * the README, annotating it as SupabaseClient re-widens the schema to public).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

import {
  toCents,
  centsToDecimalString,
  piastersToUsdCents,
  applyDiscountBps,
} from "../src/lib/money";
import type { StockStatus, VerificationLevel } from "../src/lib/db-types";
import {
  CURATED_TEMPLATES,
  SEED_SUPPLIERS,
  GROUP_SUPPLIERS,
  BREAK_LADDER,
  MIRROR_SUPPLIER_SLUG,
  type CuratedGroupKey,
} from "./curated-catalog";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ELECT_I_ROOT = resolve(SCRIPT_DIR, "..");
const REPO_ROOT = resolve(ELECT_I_ROOT, "..");
const CSV_PATH = resolve(REPO_ROOT, "data/catalog_source.csv");

const DRY_RUN = process.argv.includes("--dry-run");
const DEFAULT_EGP_PER_USD = 48.5;
const CHUNK = 500;
const SCHEMA = "eig";

/** group_key (from eig.categories) → the category slug the migration seeded. */
const GROUP_TO_CATEGORY_SLUG: Record<string, string> = {
  electronics: "electronics",
  industrial: "electrical-industrial",
  home: "home-lifestyle",
  fashion: "fashion-accessories",
  office: "office-commercial",
  automotive: "automotive",
  other: "other-wholesale",
  medical: "medical-lab",
};

/** Quantity ladder attached to a share of mirror products (MOQ is 1). */
const MIRROR_BREAK_LADDER: ReadonlyArray<{ minQty: number; discountBps: number }> = [
  { minQty: 10, discountBps: 300 },
  { minQty: 50, discountBps: 600 },
  { minQty: 100, discountBps: 900 },
  { minQty: 250, discountBps: 1200 },
];

/* ── env ─────────────────────────────────────────────────────────────────── */

/** Minimal .env.local loader (mirrors the HDML importer; no dotenv dep). */
function loadEnvLocal(): void {
  const p = resolve(ELECT_I_ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const [, key, raw] = m;
    if (process.env[key] !== undefined) continue;
    process.env[key] = raw.replace(/^["']|["']$/g, "");
  }
}

/* ── hashing / slugs (pure, deterministic, portable) ─────────────────────── */

/** FNV-1a 64-bit → base36, fixed width. Same input ⇒ same output, forever. */
function fnv1a64(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (const b of new TextEncoder().encode(input)) {
    hash ^= BigInt(b);
    hash = (hash * prime) & mask;
  }
  return hash.toString(36).padStart(13, "0");
}

/** FNV-1a 32-bit as an unsigned int, for deterministic bucketing. */
function fnv32(input: string): number {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(input)) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function eigSku(identity: string): string {
  return `EIG-${fnv1a64(identity).slice(0, 8).toUpperCase()}`;
}

/** The HDML-style code the HDML importer would derive — stored for cross-ref. */
function hdmlSku(normName: string, priceDecimal: string): string {
  return `HDML-${fnv1a64(`${normName}|${priceDecimal}`).slice(0, 8).toUpperCase()}`;
}

function slugify(input: string, maxLength = 80): string {
  const s = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const trimmed = s.slice(0, maxLength).replace(/-+$/g, "");
  return trimmed || "product";
}

/* ── review heuristics (mirror of the HDML importer's rules) ─────────────── */

function reviewFlags(name: string): string[] {
  const flags: string[] = [];
  if (/_/.test(name)) flags.push("generic_name");
  if (name.trim().length < 12) flags.push("very_short_name");
  // Mojibake: mangled Arabic surfaces as dense Latin-1 supplement noise.
  const weird = (name.match(/[¡-ÿŒ-˜]/g) ?? []).length;
  if (weird >= 3) flags.push("corrupted_text");
  if (/[؀-ۿ]/.test(name)) flags.push("arabic_text");
  return flags;
}

/* ── brand inference (compact list; word-boundary, longest match wins) ───── */

const KNOWN_BRANDS = [
  "Anker", "Soundcore", "Oraimo", "JBL", "Belkin", "Kingston", "Canon", "Epson",
  "TP-Link", "Tenda", "D-Link", "Mikrotik", "Netgear", "Xiaomi", "Redmi",
  "Samsung", "Apple", "Baseus", "Ugreen", "Lenovo", "HP", "Dell", "Asus",
  "Acer", "MSI", "Logitech", "SanDisk", "Western Digital", "WD", "Sony",
  "Huawei", "Realme", "Oppo", "Vivo", "Infinix", "Tecno", "Honor", "Nokia",
  "Amazfit", "Energizer", "Camelion", "Duracell", "Toshiba", "Seagate", "Adata",
  "Lexar", "PNY", "Transcend", "Crucial", "Netac", "Genius", "A4Tech",
  "Redragon", "Havit", "Fantech", "Aula", "Rapoo", "Green Lion", "Powerology",
  "Porodo", "Momax", "Spigen", "Nillkin", "OtterBox", "Edifier", "Tronsmart",
  "Beats", "Bose", "Marshall", "Harman Kardon", "Joyroom", "Hoco", "Remax",
  "Philips", "LG", "Sharp", "Brother", "Ricoh", "Zebra", "Godox", "DJI",
  "GoPro", "Insta360", "Nintendo", "Microsoft", "Razer", "HyperX", "Corsair",
  "Tapo", "Wiwu", "Devia", "Ldnio", "Vention", "Orico", "Promate", "Riversong",
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BRAND_MATCHERS = [...new Set(KNOWN_BRANDS)]
  .sort((a, b) => b.length - a.length)
  .map((name) => ({
    name,
    pattern: new RegExp(
      `(?<![a-z0-9])${escapeRegExp(name).replace(/[- ]/g, "[- ]?")}(?![a-z0-9])`,
      "i",
    ),
  }));

function inferBrand(name: string): string | null {
  for (const m of BRAND_MATCHERS) {
    if (m.pattern.test(name)) return m.name;
  }
  return null;
}

/* ── CSV parser (RFC-4180: quotes, escaped quotes, embedded separators) ──── */

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

/* ── the plan ────────────────────────────────────────────────────────────── */

interface BreakPlan {
  minQty: number;
  unitPriceDecimal: string;
}

interface ProductPlan {
  sku: string;
  slug: string;
  name_en: string;
  name_zh: string;
  description_en: string | null;
  groupKey: string;
  brandName: string | null;
  supplierSlug: string;
  listPriceDecimal: string;
  moq: number;
  stock_status: StockStatus;
  lead_time_days: number | null;
  unit: string;
  specs: Record<string, string>;
  hdml_sku: string | null;
  source: "hdml_mirror" | "curated";
  active: boolean;
  featured: boolean;
  needs_review: boolean;
  review_reason: string | null;
  breaks: BreakPlan[];
}

interface Rejected {
  name: string;
  reason: string;
}

interface Plan {
  products: ProductPlan[];
  rejected: Rejected[];
  rate: number;
  rateSource: "settings" | "default";
  sourceRows: number;
  duplicatesCollapsed: number;
  conflictingNames: number;
}

/* ── mirror (HDML CSV) ───────────────────────────────────────────────────── */

interface SourceRow {
  name: string;
  priceDecimal: string; // canonical EGP "1234.50"
}

function buildMirrorPlans(
  csvText: string,
  rate: number,
  usedSkus: Set<string>,
  usedSlugs: Set<string>,
): { products: ProductPlan[]; rejected: Rejected[]; sourceRows: number; duplicatesCollapsed: number; conflictingNames: number } {
  const parsed = parseCsv(csvText);
  const [header, ...dataRows] = parsed;
  if (!header || header[0] !== "name" || header[1] !== "price") {
    throw new Error(`Unexpected CSV header: ${header?.join(",") ?? "(none)"} — expected "name,price"`);
  }

  const rejected: Rejected[] = [];
  const rows: SourceRow[] = [];
  for (const r of dataRows) {
    const name = (r[0] ?? "").trim();
    const rawPrice = (r[1] ?? "").trim();
    if (!name) {
      rejected.push({ name: rawPrice || "(blank row)", reason: "empty_name" });
      continue;
    }
    let piasters: number;
    try {
      piasters = toCents(rawPrice); // EGP decimal → integer piasters
    } catch {
      rejected.push({ name, reason: "unparseable_price" });
      continue;
    }
    rows.push({ name, priceDecimal: centsToDecimalString(piasters) });
  }
  const sourceRows = dataRows.length;

  // Collapse exact (name, price) duplicates.
  const comboSeen = new Set<string>();
  const combos: SourceRow[] = [];
  for (const r of rows) {
    const key = `${r.name} ${r.priceDecimal}`;
    if (comboSeen.has(key)) continue;
    comboSeen.add(key);
    combos.push(r);
  }
  const duplicatesCollapsed = rows.length - combos.length;

  // Group by name to detect conflicting prices.
  const byName = new Map<string, SourceRow[]>();
  for (const r of combos) {
    const list = byName.get(r.name) ?? [];
    list.push(r);
    byName.set(r.name, list);
  }

  const products: ProductPlan[] = [];
  let conflictingNames = 0;
  for (const [name, variants] of byName) {
    const isConflict = variants.length > 1;
    if (isConflict) conflictingNames++;

    for (const v of variants) {
      const normName = name.toLowerCase().replace(/\s+/g, " ");
      const listCents = piastersToUsdCents(toCents(v.priceDecimal), rate);

      const flags = reviewFlags(name);
      if (isConflict) flags.unshift(`conflicting_prices(${variants.length})`);
      if (listCents === 0) flags.push("zero_price");
      const needsReview = flags.length > 0;

      const identity = `hdml_mirror|${normName}|${v.priceDecimal}`;
      let sku = eigSku(identity);
      while (usedSkus.has(sku)) sku = `${sku}X`;
      usedSkus.add(sku);

      let slug = slugify(name);
      let n = 1;
      while (usedSlugs.has(slug)) slug = `${slugify(name)}-${++n}`;
      usedSlugs.add(slug);

      const brandName = inferBrand(name);

      // A deterministic ~60% share of clean products get a quantity ladder.
      const bucket = fnv32(sku);
      const breaks: BreakPlan[] =
        !needsReview && listCents > 0 && bucket % 10 < 6
          ? MIRROR_BREAK_LADDER.slice(0, 2 + (bucket % 3)).map((b) => ({
              minQty: b.minQty,
              unitPriceDecimal: centsToDecimalString(applyDiscountBps(listCents, b.discountBps)),
            }))
          : [];

      products.push({
        sku,
        slug,
        name_en: name,
        name_zh: "", // no real translation — app falls back to name_en
        description_en: null,
        groupKey: "electronics",
        brandName,
        supplierSlug: MIRROR_SUPPLIER_SLUG,
        listPriceDecimal: centsToDecimalString(listCents),
        moq: 1,
        stock_status: "confirm_availability",
        lead_time_days: null,
        unit: "piece",
        specs: {},
        hdml_sku: hdmlSku(normName, v.priceDecimal),
        source: "hdml_mirror",
        active: !needsReview,
        featured: !needsReview && listCents > 0 && bucket % 97 === 0,
        needs_review: needsReview,
        review_reason: needsReview ? flags.join(", ") : null,
        breaks,
      });
    }
  }

  return { products, rejected, sourceRows, duplicatesCollapsed, conflictingNames };
}

/* ── curated (the other seven groups) ────────────────────────────────────── */

function buildCuratedPlans(usedSkus: Set<string>, usedSlugs: Set<string>): ProductPlan[] {
  const products: ProductPlan[] = [];

  for (const t of CURATED_TEMPLATES) {
    const suppliers = GROUP_SUPPLIERS[t.group as CuratedGroupKey];
    t.variants.forEach((variant, vIndex) => {
      const listCents = t.baseCents + t.stepCents * vIndex;
      const name = `${t.name} - ${variant}`;

      const identity = `curated|${t.group}|${t.name}|${variant}`;
      let sku = eigSku(identity);
      while (usedSkus.has(sku)) sku = `${sku}X`;
      usedSkus.add(sku);

      let slug = slugify(name);
      let n = 1;
      while (usedSlugs.has(slug)) slug = `${slugify(name)}-${++n}`;
      usedSlugs.add(slug);

      const bucket = fnv32(sku);
      const supplierSlug = suppliers[bucket % suppliers.length];

      const breaks: BreakPlan[] = BREAK_LADDER.slice(0, t.tiers).map((b) => ({
        minQty: t.moq * b.qtyMultiple,
        unitPriceDecimal: centsToDecimalString(applyDiscountBps(listCents, b.discountBps)),
      }));

      products.push({
        sku,
        slug,
        name_en: name,
        name_zh: "",
        description_en: `Bulk wholesale ${t.name.toLowerCase()} in a ${variant} configuration. Priced per ${t.unit}; minimum order ${t.moq} ${t.unit}${t.moq === 1 ? "" : "s"}.`,
        groupKey: t.group,
        brandName: null,
        supplierSlug,
        listPriceDecimal: centsToDecimalString(listCents),
        moq: t.moq,
        stock_status: t.stock,
        lead_time_days: t.leadTimeDays,
        unit: t.unit,
        specs: { ...t.specs, Variant: variant },
        hdml_sku: null,
        source: "curated",
        active: true,
        featured: bucket % 11 === 0,
        needs_review: false,
        review_reason: null,
        breaks,
      });
    });
  }

  return products;
}

/* ── plan assembly ───────────────────────────────────────────────────────── */

function buildPlan(csvText: string, rate: number, rateSource: "settings" | "default"): Plan {
  const usedSkus = new Set<string>();
  const usedSlugs = new Set<string>();

  const mirror = buildMirrorPlans(csvText, rate, usedSkus, usedSlugs);
  const curated = buildCuratedPlans(usedSkus, usedSlugs);

  return {
    products: [...mirror.products, ...curated],
    rejected: mirror.rejected,
    rate,
    rateSource,
    sourceRows: mirror.sourceRows,
    duplicatesCollapsed: mirror.duplicatesCollapsed,
    conflictingNames: mirror.conflictingNames,
  };
}

/* ── reporting ───────────────────────────────────────────────────────────── */

function summarise(plan: Plan): void {
  const mirror = plan.products.filter((p) => p.source === "hdml_mirror");
  const curated = plan.products.filter((p) => p.source === "curated");
  const active = plan.products.filter((p) => p.active).length;
  const review = plan.products.filter((p) => p.needs_review);
  const breaks = plan.products.reduce((s, p) => s + p.breaks.length, 0);
  const withBreaks = plan.products.filter((p) => p.breaks.length > 0).length;

  console.log("");
  console.log("── Catalog seed plan ─────────────────────────────────────────");
  console.log(`  FX rate            : ${plan.rate} EGP/USD (from ${plan.rateSource})`);
  console.log(`  CSV source rows    : ${plan.sourceRows}`);
  console.log(`  duplicates collapsed: ${plan.duplicatesCollapsed}`);
  console.log(`  conflicting names  : ${plan.conflictingNames}`);
  console.log(`  rejected rows      : ${plan.rejected.length}`);
  console.log("");
  console.log(`  products (total)   : ${plan.products.length}`);
  console.log(`    hdml_mirror      : ${mirror.length}`);
  console.log(`    curated          : ${curated.length}`);
  console.log(`    active           : ${active}`);
  console.log(`    needs_review     : ${review.length}`);
  console.log(`  suppliers          : ${SEED_SUPPLIERS.length}`);
  console.log(`  products w/ breaks : ${withBreaks}`);
  console.log(`  price break rows   : ${breaks}`);

  // needs_review breakdown by reason.
  const byReason = new Map<string, number>();
  for (const p of review) {
    const primary = (p.review_reason ?? "").split(",")[0].trim() || "unknown";
    byReason.set(primary, (byReason.get(primary) ?? 0) + 1);
  }
  if (byReason.size) {
    console.log("");
    console.log("  needs_review by reason (primary):");
    for (const [reason, count] of [...byReason].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${reason.padEnd(24)} ${count}`);
    }
  }

  // curated per group.
  const byGroup = new Map<string, number>();
  for (const p of curated) byGroup.set(p.groupKey, (byGroup.get(p.groupKey) ?? 0) + 1);
  console.log("");
  console.log("  curated by group:");
  for (const [group, count] of byGroup) {
    console.log(`    ${group.padEnd(24)} ${count} → ${GROUP_TO_CATEGORY_SLUG[group]}`);
  }

  if (plan.rejected.length) {
    console.log("");
    console.log(`  rejected samples (${Math.min(10, plan.rejected.length)} of ${plan.rejected.length}):`);
    for (const r of plan.rejected.slice(0, 10)) {
      const nm = r.name.length > 50 ? `${r.name.slice(0, 47)}…` : r.name;
      console.log(`    [${r.reason}] ${nm}`);
    }
  }
  console.log("──────────────────────────────────────────────────────────────");
}

/* ── DB client ───────────────────────────────────────────────────────────── */

/**
 * Service-role client pinned to the `eig` schema — the same configuration as
 * src/lib/supabase/server.ts:supabaseService(), reproduced here because that
 * module is `server-only` and cannot be imported under tsx. Type is left
 * inferred so the schema generic stays "eig" (never widen to "public").
 */
function eigServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. " +
        "Set them in elect-i/.env.local (see .env.example), or use --dry-run.",
    );
  }
  // Node 20 has no global WebSocket; supabase-js constructs one. Harmless shim.
  if (typeof globalThis.WebSocket === "undefined") {
    try {
      const nodeRequire = createRequire(import.meta.url);
      (globalThis as { WebSocket?: unknown }).WebSocket = nodeRequire("ws").WebSocket;
    } catch {
      /* realtime is never used here; ignore if ws is unavailable */
    }
  }
  return createClient(url, key, {
    db: { schema: SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Db = ReturnType<typeof eigServiceClient>;

async function resolveRate(db: Db): Promise<number> {
  const { data, error } = await db.from("settings").select("value").eq("key", "pricing").maybeSingle();
  if (error) {
    console.warn(`  ! could not read eig.settings.pricing (${error.message}); using default rate`);
    return DEFAULT_EGP_PER_USD;
  }
  const raw = (data?.value as { egp_per_usd?: unknown } | null)?.egp_per_usd;
  const rate = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_EGP_PER_USD;
}

/* ── writes ──────────────────────────────────────────────────────────────── */

async function upsertSuppliers(db: Db): Promise<Map<string, string>> {
  const rows = SEED_SUPPLIERS.map((s) => ({
    slug: s.slug,
    name: s.name,
    country: s.country,
    city: s.city,
    verification: s.verification as VerificationLevel,
    response_rate: s.responseRate,
    lead_time_days: s.leadTimeDays,
    description: s.description,
    active: true,
  }));
  // ignoreDuplicates: never overwrite a manually edited supplier.
  const { error } = await db.from("suppliers").upsert(rows, {
    onConflict: "slug",
    ignoreDuplicates: true,
  });
  if (error) throw new Error(`supplier upsert failed: ${error.message}`);

  const { data, error: readErr } = await db.from("suppliers").select("id, slug");
  if (readErr) throw new Error(`reading suppliers failed: ${readErr.message}`);
  return new Map((data ?? []).map((r) => [r.slug as string, r.id as string]));
}

async function upsertBrands(db: Db, plan: Plan): Promise<Map<string, string>> {
  const names = [...new Set(plan.products.map((p) => p.brandName).filter((b): b is string => !!b))];
  const rows = names.map((name) => ({ name, slug: slugify(name, 60) }));
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db.from("brands").upsert(rows.slice(i, i + CHUNK), {
      onConflict: "slug",
      ignoreDuplicates: true,
    });
    if (error) throw new Error(`brand upsert failed: ${error.message}`);
  }
  const { data, error } = await db.from("brands").select("id, name");
  if (error) throw new Error(`reading brands failed: ${error.message}`);
  return new Map((data ?? []).map((r) => [r.name as string, r.id as string]));
}

async function readCategoriesByGroup(db: Db): Promise<Map<string, string>> {
  const { data, error } = await db.from("categories").select("id, slug, group_key");
  if (error) throw new Error(`reading categories failed: ${error.message}`);
  const byGroup = new Map<string, string>();
  for (const r of data ?? []) {
    // Prefer the top-level row (matching the seeded slug) for each group_key.
    const expectedSlug = GROUP_TO_CATEGORY_SLUG[r.group_key as string];
    if (r.slug === expectedSlug) byGroup.set(r.group_key as string, r.id as string);
    else if (!byGroup.has(r.group_key as string)) byGroup.set(r.group_key as string, r.id as string);
  }
  return byGroup;
}

async function readExisting(db: Db): Promise<{ skus: Set<string>; slugs: Set<string> }> {
  const skus = new Set<string>();
  const slugs = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("products").select("sku, slug").range(from, from + 999);
    if (error) throw new Error(`reading existing products failed: ${error.message}`);
    for (const r of data ?? []) {
      skus.add(r.sku as string);
      slugs.add(r.slug as string);
    }
    if (!data || data.length < 1000) break;
  }
  return { skus, slugs };
}

async function seed(plan: Plan): Promise<void> {
  const db = eigServiceClient();

  console.log("  connecting and reading current state…");
  const supplierIds = await upsertSuppliers(db);
  const brandIds = await upsertBrands(db, plan);
  const categoryIds = await readCategoriesByGroup(db);
  const existing = await readExisting(db);

  if (categoryIds.size === 0) {
    throw new Error("eig.categories is empty — run supabase/migrations/0007_eig_init.sql first.");
  }

  // Only insert products whose SKU is not already present.
  const skipped = plan.products.filter((p) => existing.skus.has(p.sku));
  const toInsert = plan.products.filter((p) => !existing.skus.has(p.sku));

  console.log(`  suppliers: ${supplierIds.size} · brands: ${brandIds.size} · categories: ${categoryIds.size}`);
  console.log(`  products: ${toInsert.length} to insert, ${skipped.length} already present`);

  if (toInsert.length === 0) {
    console.log("  nothing new to insert (idempotent re-run).");
    await writeSeedMeta(db, plan, 0, 0);
    return;
  }

  // Products carry a random uuid; we recover ids by SKU afterwards to attach
  // price breaks. Bump any slug that would collide with an existing row.
  const rejectedAtWrite: Rejected[] = [];
  let inserted = 0;
  const insertedSkus: string[] = [];

  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const rows: Array<Record<string, unknown>> = [];
    for (const p of chunk) {
      const categoryId = categoryIds.get(p.groupKey);
      if (!categoryId) {
        rejectedAtWrite.push({ name: p.name_en, reason: `no_category_for_group(${p.groupKey})` });
        continue;
      }
      let slug = p.slug;
      while (existing.slugs.has(slug)) slug = `${slug}-i`;
      existing.slugs.add(slug);

      rows.push({
        sku: p.sku,
        slug,
        name_en: p.name_en,
        name_zh: p.name_zh,
        description_en: p.description_en,
        category_id: categoryId,
        brand_id: p.brandName ? (brandIds.get(p.brandName) ?? null) : null,
        supplier_id: supplierIds.get(p.supplierSlug) ?? null,
        list_price: p.listPriceDecimal,
        moq: p.moq,
        stock_status: p.stock_status,
        lead_time_days: p.lead_time_days,
        unit: p.unit,
        images: [],
        specs: p.specs,
        hdml_sku: p.hdml_sku,
        source: p.source,
        active: p.active,
        featured: p.featured,
        needs_review: p.needs_review,
        review_reason: p.review_reason,
      });
    }
    if (rows.length === 0) continue;

    const { data, error } = await db
      .from("products")
      .upsert(rows, { onConflict: "sku", ignoreDuplicates: true })
      .select("sku");
    if (error) throw new Error(`product insert failed at chunk ${i / CHUNK}: ${error.message}`);
    inserted += data?.length ?? 0;
    for (const r of data ?? []) insertedSkus.push(r.sku as string);
    console.log(`    products ${Math.min(i + CHUNK, toInsert.length)}/${toInsert.length}`);
  }

  // Attach price breaks — only for products actually inserted this run.
  const insertedSet = new Set(insertedSkus);
  const skuToId = await mapSkusToIds(db, insertedSkus);
  const breakRows: Array<{ product_id: string; min_qty: number; unit_price: string }> = [];
  for (const p of toInsert) {
    if (!insertedSet.has(p.sku) || p.breaks.length === 0) continue;
    const id = skuToId.get(p.sku);
    if (!id) continue;
    for (const b of p.breaks) {
      breakRows.push({ product_id: id, min_qty: b.minQty, unit_price: b.unitPriceDecimal });
    }
  }

  let breaksInserted = 0;
  for (let i = 0; i < breakRows.length; i += CHUNK) {
    const { error } = await db
      .from("product_price_breaks")
      .upsert(breakRows.slice(i, i + CHUNK), {
        onConflict: "product_id,min_qty",
        ignoreDuplicates: true,
      });
    if (error) throw new Error(`price break insert failed at chunk ${i / CHUNK}: ${error.message}`);
    breaksInserted += breakRows.slice(i, i + CHUNK).length;
  }

  await writeSeedMeta(db, plan, inserted, breaksInserted);

  console.log("");
  console.log(`  ✓ inserted ${inserted} products and ${breaksInserted} price breaks.`);
  if (rejectedAtWrite.length) {
    console.log(`  ! ${rejectedAtWrite.length} rows rejected at write:`);
    for (const r of rejectedAtWrite.slice(0, 10)) console.log(`    [${r.reason}] ${r.name}`);
  }
}

async function mapSkusToIds(db: Db, skus: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let i = 0; i < skus.length; i += CHUNK) {
    const { data, error } = await db
      .from("products")
      .select("id, sku")
      .in("sku", skus.slice(i, i + CHUNK));
    if (error) throw new Error(`mapping skus→ids failed: ${error.message}`);
    for (const r of data ?? []) map.set(r.sku as string, r.id as string);
  }
  return map;
}

async function writeSeedMeta(db: Db, plan: Plan, inserted: number, breaks: number): Promise<void> {
  const { error } = await db.from("settings").upsert(
    {
      key: "catalog_seed",
      value: {
        last_run_at: new Date().toISOString(),
        egp_per_usd: plan.rate,
        rate_source: plan.rateSource,
        source_rows: plan.sourceRows,
        planned_products: plan.products.length,
        inserted_last_run: inserted,
        price_breaks_last_run: breaks,
        rejected_rows: plan.rejected.length,
      },
    },
    { onConflict: "key" },
  );
  if (error) console.warn(`  ! could not record catalog_seed metadata: ${error.message}`);
}

/* ── main ────────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  loadEnvLocal();

  if (!existsSync(CSV_PATH)) {
    throw new Error(`Source catalog not found at ${CSV_PATH}`);
  }
  const csvText = readFileSync(CSV_PATH, "utf8");

  console.log(`ELECT-I catalog seed${DRY_RUN ? " (dry run — no writes)" : ""}`);
  console.log(`  source: ${CSV_PATH}`);

  let rate = DEFAULT_EGP_PER_USD;
  let rateSource: "settings" | "default" = "default";

  if (!DRY_RUN) {
    const db = eigServiceClient();
    rate = await resolveRate(db);
    rateSource = rate === DEFAULT_EGP_PER_USD ? "default" : "settings";
  } else {
    // Dry run stays fully offline. Allow an env override for realistic preview.
    const envRate = Number(process.env.EGP_PER_USD);
    if (Number.isFinite(envRate) && envRate > 0) {
      rate = envRate;
      rateSource = "default";
    }
  }

  const plan = buildPlan(csvText, rate, rateSource);
  summarise(plan);

  if (DRY_RUN) {
    console.log("");
    console.log("Dry run complete — no database writes performed.");
    return;
  }

  console.log("");
  await seed(plan);
  console.log("Done.");
}

main().catch((err) => {
  console.error("");
  console.error(`seed-catalog failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
