import "server-only";
import {
  PAGE_SIZE,
  SORTS,
  STOCK_STATUSES,
  type CatalogSort,
  type CatalogQuery,
  type SupplierRef,
  type CategoryRef,
  type ProductListing,
  type PriceLadderRow,
  type ProductDetail,
  type CatalogPage,
  type CategoryOption,
  type SupplierOption,
  type RawSearchParams,
} from "@/lib/catalog-shared";

// Re-exported so server callers can keep importing everything from here.
export {
  PAGE_SIZE,
  SORTS,
  STOCK_STATUSES,
};
export type {
  CatalogSort,
  CatalogQuery,
  SupplierRef,
  CategoryRef,
  ProductListing,
  PriceLadderRow,
  ProductDetail,
  CatalogPage,
  CategoryOption,
  SupplierOption,
  RawSearchParams,
};

import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";
import { currentPrivileges } from "@/lib/auth";
import { toCents, tieredUnitPrice } from "@/lib/money";
import { effectiveMoq, tierUnitPriceCents, type Tier } from "@/lib/tiers";
import type { StockStatus, VerificationLevel } from "@/lib/db-types";
import { CATEGORY_GROUPS } from "@/lib/categories";
import type { Locale } from "@/i18n/config";

/** Deep pagination past this is bot traffic, not buyers. */
const MAX_PAGE = 200;

/**
 * Server-side catalog access.
 *
 * The table holds 9,000+ rows, so nothing here ever selects the whole catalog:
 * every list query filters, sorts, counts and paginates inside Postgres and
 * returns at most one page of rows.
 *
 * Pricing rule: the visitor's tier is resolved ONCE per request from the
 * authenticated session (never from a query string or a client payload) and
 * every price the browser sees is computed from it on the server.
 *
 * Every function degrades to an empty result instead of throwing when the
 * database is unreachable or unseeded — the catalog surface must still render.
 */

 // deep pagination past this is bot traffic, not buyers




















/* ── request-scoped visitor pricing ─────────────────────────────────────── */

/**
 * Resolved once per request via React's cache, so a page that renders 24 cards
 * plus a sidebar performs exactly one tier lookup.
 */
export const visitorTier = cache(async (): Promise<Tier> => {
  try {
    const { tier } = await currentPrivileges();
    return tier;
  } catch {
    return "buyer";
  }
});

/* ── helpers ────────────────────────────────────────────────────────────── */

function priceCents(value: unknown): number {
  if (value === null || value === undefined) return 0;
  try {
    return toCents(String(value));
  } catch {
    return 0;
  }
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

function asSpecs(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === null || v === undefined) continue;
    out[k] = String(v);
  }
  return out;
}

/**
 * PostgREST treats `,` `(` `)` and `.` as syntax inside an `or=` filter, and
 * `%` `_` as LIKE wildcards. Strip them rather than escaping so a stray
 * character can never change the shape of the query.
 */
function sanitizeTerm(raw: string): string {
  return raw
    .replace(/[%_,().*\\"':;]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function intParam(value: string | undefined, min: number, max: number): number | null {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}



/** Normalise the URL into a query. Everything lives in the URL so results are linkable. */
export function parseCatalogQuery(sp: RawSearchParams): CatalogQuery {
  const sortRaw = one(sp.sort);
  const stockRaw = one(sp.stock);
  const minUsd = intParam(one(sp.min), 0, 10_000_000);
  const maxUsd = intParam(one(sp.max), 0, 10_000_000);

  return {
    q: sanitizeTerm(one(sp.q) ?? ""),
    category: (one(sp.category) ?? "").trim().slice(0, 80),
    supplier: (one(sp.supplier) ?? "").trim().slice(0, 80),
    minUsd,
    // A reversed range returns nothing at all, which reads as a bug; swap it.
    maxUsd: minUsd !== null && maxUsd !== null && maxUsd < minUsd ? null : maxUsd,
    stock: STOCK_STATUSES.includes(stockRaw as StockStatus) ? (stockRaw as StockStatus) : null,
    sort: (SORTS as readonly string[]).includes(sortRaw ?? "")
      ? (sortRaw as CatalogSort)
      : "relevance",
    page: intParam(one(sp.page), 1, MAX_PAGE) ?? 1,
  };
}

/** Serialise a query back to a query string, dropping defaults. */
export function catalogQueryString(query: Partial<CatalogQuery>): string {
  const p = new URLSearchParams();
  if (query.q) p.set("q", query.q);
  if (query.category) p.set("category", query.category);
  if (query.supplier) p.set("supplier", query.supplier);
  if (query.minUsd !== null && query.minUsd !== undefined) p.set("min", String(query.minUsd));
  if (query.maxUsd !== null && query.maxUsd !== undefined) p.set("max", String(query.maxUsd));
  if (query.stock) p.set("stock", query.stock);
  if (query.sort && query.sort !== "relevance") p.set("sort", query.sort);
  if (query.page && query.page > 1) p.set("page", String(query.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/* ── row shapes returned by the embedded selects ────────────────────────── */

interface RawSupplier {
  slug: string;
  name: string;
  country: string | null;
  verification: VerificationLevel;
  lead_time_days: number | null;
}

interface RawCategory {
  slug: string;
  name_en: string;
  name_zh: string | null;
  group_key: string;
}

interface RawProduct {
  id: string;
  sku: string;
  slug: string;
  name_en: string;
  name_zh: string | null;
  description_en: string | null;
  description_zh: string | null;
  list_price: number | string;
  moq: number;
  stock_status: StockStatus;
  lead_time_days: number | null;
  unit: string;
  images: unknown;
  specs?: unknown;
  featured: boolean;
  created_at: string;
  category?: RawCategory | RawCategory[] | null;
  supplier?: RawSupplier | RawSupplier[] | null;
}

const LIST_COLUMNS =
  "id,sku,slug,name_en,name_zh,description_en,description_zh,list_price,moq,stock_status," +
  "lead_time_days,unit,images,featured,created_at," +
  "category:categories(slug,name_en,name_zh,group_key)," +
  "supplier:suppliers(slug,name,country,verification,lead_time_days)";

const DETAIL_COLUMNS = `${LIST_COLUMNS},specs`;

function localised(en: string | null, zh: string | null, lang: Locale): string {
  if (lang === "zh" && zh && zh.trim()) return zh;
  return en ?? "";
}

function toListing(row: RawProduct, lang: Locale, tier: Tier): ProductListing {
  const listCents = priceCents(row.list_price);
  const yourCents = tierUnitPriceCents(listCents, tier);
  const images = asStringArray(row.images);
  const category = firstOf(row.category);
  const supplier = firstOf(row.supplier);

  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: localised(row.name_en, row.name_zh, lang),
    description: localised(row.description_en, row.description_zh, lang) || null,
    image: images[0] ?? null,
    images,
    listCents,
    yourCents,
    savingCents: Math.max(0, listCents - yourCents),
    moq: row.moq,
    effectiveMoq: effectiveMoq(row.moq, tier),
    stockStatus: row.stock_status,
    leadTimeDays: row.lead_time_days,
    unit: row.unit,
    featured: row.featured,
    supplier: supplier
      ? {
          slug: supplier.slug,
          name: supplier.name,
          country: supplier.country,
          verification: supplier.verification,
          leadTimeDays: supplier.lead_time_days,
        }
      : null,
    category: category
      ? {
          slug: category.slug,
          name: localised(category.name_en, category.name_zh, lang),
          groupKey: category.group_key,
        }
      : null,
  };
}

const EMPTY_PAGE: CatalogPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: PAGE_SIZE,
  totalPages: 0,
  degraded: false,
};

/* ── category + supplier lookups ────────────────────────────────────────── */



/** All categories, cheapest possible select. Cached per request. */
export const listCategories = cache(async (lang: Locale): Promise<CategoryOption[]> => {
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from("categories")
      .select("id,slug,name_en,name_zh,group_key,parent_id,sort")
      .order("sort", { ascending: true })
      .order("name_en", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id as string,
      slug: row.slug as string,
      name: localised(row.name_en as string, (row.name_zh as string | null) ?? null, lang),
      groupKey: row.group_key as string,
      parentId: (row.parent_id as string | null) ?? null,
    }));
  } catch (err) {
    console.error("catalog: listCategories failed —", (err as Error).message);
    return [];
  }
});

/** Category ids for a slug, including its direct children. */
async function categoryIdsForSlug(slug: string): Promise<string[]> {
  if (!slug) return [];
  const categories = await listCategories("en");
  const root = categories.find((c) => c.slug === slug);
  if (!root) return [];
  const children = categories.filter((c) => c.parentId === root.id).map((c) => c.id);
  return [root.id, ...children];
}

/** Category ids belonging to one of the eight top-level groups. */
export async function categoryIdsForGroup(groupKey: string): Promise<string[]> {
  const categories = await listCategories("en");
  return categories.filter((c) => c.groupKey === groupKey).map((c) => c.id);
}



export const listSuppliers = cache(async (): Promise<SupplierOption[]> => {
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from("suppliers")
      .select(
        "id,slug,name,country,city,verification,response_rate,lead_time_days,description,products(count)",
      )
      .eq("active", true)
      .order("name", { ascending: true })
      .limit(300);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => {
      const counts = row.products as Array<{ count: number }> | null | undefined;
      return {
        id: row.id as string,
        slug: row.slug as string,
        name: row.name as string,
        country: (row.country as string | null) ?? null,
        city: (row.city as string | null) ?? null,
        verification: row.verification as VerificationLevel,
        responseRate: (row.response_rate as number | null) ?? null,
        leadTimeDays: (row.lead_time_days as number | null) ?? null,
        description: (row.description as string | null) ?? null,
        productCount: Array.isArray(counts) ? (counts[0]?.count ?? 0) : null,
      };
    });
  } catch (err) {
    console.error("catalog: listSuppliers failed —", (err as Error).message);
    return [];
  }
});

async function supplierIdForSlug(slug: string): Promise<string | null> {
  if (!slug) return null;
  const suppliers = await listSuppliers();
  return suppliers.find((s) => s.slug === slug)?.id ?? null;
}

/* ── search ─────────────────────────────────────────────────────────────── */

export interface SearchOptions {
  /** Restrict to one of the eight top-level groups (category landing pages). */
  groupKey?: string;
  pageSize?: number;
}

export async function searchProducts(
  query: CatalogQuery,
  lang: Locale,
  options: SearchOptions = {},
): Promise<CatalogPage> {
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const tier = await visitorTier();

  try {
    const supabase = await supabaseServer();
    let builder = supabase
      .from("products")
      .select(LIST_COLUMNS, { count: "exact" })
      .eq("active", true);

    // Free-text: every token must match somewhere. PostgREST ANDs repeated
    // `or=` params, so one .or() per token gives token-AND, field-OR.
    if (query.q) {
      for (const token of query.q.split(" ").filter(Boolean).slice(0, 4)) {
        builder = builder.or(
          `name_en.ilike.%${token}%,name_zh.ilike.%${token}%,sku.ilike.%${token}%`,
        );
      }
    }

    if (options.groupKey) {
      const ids = await categoryIdsForGroup(options.groupKey);
      if (ids.length === 0) return { ...EMPTY_PAGE, page: query.page, pageSize };
      builder = builder.in("category_id", ids);
    } else if (query.category) {
      const ids = await categoryIdsForSlug(query.category);
      if (ids.length === 0) return { ...EMPTY_PAGE, page: query.page, pageSize };
      builder = builder.in("category_id", ids);
    }

    if (query.supplier) {
      const supplierId = await supplierIdForSlug(query.supplier);
      if (!supplierId) return { ...EMPTY_PAGE, page: query.page, pageSize };
      builder = builder.eq("supplier_id", supplierId);
    }

    if (query.minUsd !== null) builder = builder.gte("list_price", query.minUsd);
    if (query.maxUsd !== null) builder = builder.lte("list_price", query.maxUsd);
    if (query.stock) builder = builder.eq("stock_status", query.stock);

    switch (query.sort) {
      case "price_asc":
        builder = builder.order("list_price", { ascending: true });
        break;
      case "price_desc":
        builder = builder.order("list_price", { ascending: false });
        break;
      case "newest":
        builder = builder.order("created_at", { ascending: false });
        break;
      default:
        // Relevance: promoted rows first, then freshest. Trigram ranking is not
        // expressible through PostgREST, so ordering stays deterministic.
        builder = builder
          .order("featured", { ascending: false })
          .order("created_at", { ascending: false });
    }
    // Stable tiebreaker: without it, equal prices can repeat across pages.
    builder = builder.order("id", { ascending: true });

    const from = (query.page - 1) * pageSize;
    const { data, count, error } = await builder.range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);

    const total = count ?? 0;
    return {
      items: (data as unknown as RawProduct[] | null ?? []).map((row) =>
        toListing(row, lang, tier),
      ),
      total,
      page: query.page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      degraded: false,
    };
  } catch (err) {
    console.error("catalog: searchProducts failed —", (err as Error).message);
    return { ...EMPTY_PAGE, page: query.page, pageSize, degraded: true };
  }
}

/* ── single product ─────────────────────────────────────────────────────── */

export async function getProductBySlug(
  slug: string,
  lang: Locale,
): Promise<ProductDetail | null> {
  const tier = await visitorTier();

  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from("products")
      .select(DETAIL_COLUMNS)
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    const row = data as unknown as RawProduct;
    const listing = toListing(row, lang, tier);

    const { data: breakRows, error: breakError } = await supabase
      .from("product_price_breaks")
      .select("min_qty,unit_price")
      .eq("product_id", listing.id)
      .order("min_qty", { ascending: true })
      .limit(20);
    if (breakError) console.error("catalog: price breaks failed —", breakError.message);

    const breaks = (breakRows ?? []).map((b) => ({
      minQty: Number(b.min_qty),
      listCents: priceCents(b.unit_price),
    }));

    const baseQty = Math.max(1, listing.moq);
    const ladder: PriceLadderRow[] = [
      { minQty: baseQty, listCents: listing.listCents, yourCents: listing.yourCents },
      ...breaks
        .filter((b) => b.minQty > baseQty)
        .map((b) => ({
          minQty: b.minQty,
          listCents: b.listCents,
          yourCents: tierUnitPriceCents(b.listCents, tier),
        })),
    ];

    return {
      ...listing,
      specs: asSpecs(row.specs),
      ladder,
      upgradeSavingCents:
        tier === "buyer"
          ? Math.max(0, listing.listCents - tierUnitPriceCents(listing.listCents, "merchant"))
          : 0,
    };
  } catch (err) {
    console.error("catalog: getProductBySlug failed —", (err as Error).message);
    return null;
  }
}

/**
 * Unit price for a quantity, resolved on the server from the stored breaks.
 * Client code may render a preview, but this is what an order would use.
 */
export function unitPriceForQty(product: ProductDetail, qty: number): number {
  return tieredUnitPrice(
    product.listCents,
    qty,
    product.ladder.map((row) => ({ minQty: row.minQty, unitPriceCents: row.listCents })),
  );
}

/* ── similar products ───────────────────────────────────────────────────── */

export async function getSimilarProducts(
  product: ProductListing,
  lang: Locale,
  limit = 4,
): Promise<ProductListing[]> {
  const tier = await visitorTier();

  try {
    const supabase = await supabaseServer();
    let builder = supabase
      .from("products")
      .select(LIST_COLUMNS)
      .eq("active", true)
      .neq("id", product.id);

    if (product.category) {
      const ids = await categoryIdsForSlug(product.category.slug);
      if (ids.length > 0) builder = builder.in("category_id", ids);
    }

    // Neighbouring price band: a $4 cable next to a $2,000 server helps nobody.
    if (product.listCents > 0) {
      const lower = Math.max(0, Math.floor((product.listCents * 0.4) / 100));
      const upper = Math.ceil((product.listCents * 2.5) / 100);
      builder = builder.gte("list_price", lower).lte("list_price", upper);
    }

    const { data, error } = await builder
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);

    return (data as unknown as RawProduct[] | null ?? []).map((row) =>
      toListing(row, lang, tier),
    );
  } catch (err) {
    console.error("catalog: getSimilarProducts failed —", (err as Error).message);
    return [];
  }
}

/* ── featured / group counts ────────────────────────────────────────────── */

export async function countProductsInGroup(groupKey: string): Promise<number> {
  try {
    const ids = await categoryIdsForGroup(groupKey);
    if (ids.length === 0) return 0;
    const supabase = await supabaseServer();
    const { count, error } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .in("category_id", ids);
    if (error) throw new Error(error.message);
    return count ?? 0;
  } catch (err) {
    console.error("catalog: countProductsInGroup failed —", (err as Error).message);
    return 0;
  }
}

export interface MarketplaceStats {
  products: number;
  categories: number;
  suppliers: number;
  /** Distinct countries the active suppliers are registered in. */
  supplierCountries: number;
}

/**
 * Headline figures for the marketing pages, read from the catalogue itself.
 *
 * These are deliberately queried rather than typed into the page: a number
 * baked into a component drifts away from reality the moment the catalogue
 * changes, and a wholesale buyer who counts the results has caught the site
 * lying. `head: true` means the rows never travel — only the count does.
 *
 * On failure every figure returns 0 and the caller hides the affected tile,
 * which is the honest outcome: no number beats a wrong one.
 */
export const marketplaceStats = cache(async (): Promise<MarketplaceStats> => {
  try {
    const supabase = await supabaseServer();
    const [products, categories, suppliers] = await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true),
      supabase.from("categories").select("id", { count: "exact", head: true }),
      supabase.from("suppliers").select("country").eq("active", true).limit(300),
    ]);

    const countries = new Set(
      (suppliers.data ?? [])
        .map((row) => (row.country as string | null)?.trim())
        .filter((country): country is string => Boolean(country)),
    );

    return {
      products: products.count ?? 0,
      categories: categories.count ?? 0,
      suppliers: suppliers.data?.length ?? 0,
      supplierCountries: countries.size,
    };
  } catch (err) {
    console.error("catalog: marketplaceStats failed —", (err as Error).message);
    return { products: 0, categories: 0, suppliers: 0, supplierCountries: 0 };
  }
});

/** Counts for all eight groups, issued in parallel. */
export async function countProductsByGroup(): Promise<Record<string, number>> {
  const entries = await Promise.all(
    CATEGORY_GROUPS.map(
      async (group) => [group.key, await countProductsInGroup(group.key)] as const,
    ),
  );
  return Object.fromEntries(entries);
}
