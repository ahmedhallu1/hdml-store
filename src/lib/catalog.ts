import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import type { Brand, Category, Product, ProductPriceTier } from "@/lib/db-types";

export const PAGE_SIZE = 24;

export type CatalogSort = "newest" | "price_asc" | "price_desc" | "name_asc";

export interface CatalogQuery {
  q?: string;
  categorySlug?: string;
  brandSlug?: string;
  /** EGP whole-pound bounds (inclusive). */
  minPrice?: number;
  maxPrice?: number;
  sort?: CatalogSort;
  page?: number;
}

export interface ProductListItem extends Product {
  categories: Pick<Category, "slug" | "name" | "icon"> | null;
  brands: Pick<Brand, "slug" | "name"> | null;
}

export interface CatalogPage {
  items: ProductListItem[];
  total: number;
  page: number;
  pageCount: number;
}

/** Escape PostgREST `ilike` wildcards in user input. */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (m) => `\\${m}`);
}

const LIST_SELECT =
  "id, sku, slug, name, price, stock_status, moq, active, images, category_id, brand_id, created_at, categories(slug, name, icon), brands(slug, name)";

/**
 * Server-side paginated catalog listing. RLS restricts results to active
 * products; the entire catalog is never shipped to the browser.
 */
export async function listProducts(query: CatalogQuery): Promise<CatalogPage> {
  const supabase = await supabaseServer();
  const page = Math.max(1, query.page ?? 1);

  let builder = supabase.from("products").select(LIST_SELECT, { count: "exact" });

  const q = query.q?.trim();
  if (q) builder = builder.ilike("name", `%${escapeLike(q).slice(0, 120)}%`);

  if (query.categorySlug) {
    const category = await getCategoryBySlug(query.categorySlug);
    if (!category) return { items: [], total: 0, page: 1, pageCount: 0 };
    builder = builder.eq("category_id", category.id);
  }
  if (query.brandSlug) {
    const brand = await getBrandBySlug(query.brandSlug);
    if (!brand) return { items: [], total: 0, page: 1, pageCount: 0 };
    builder = builder.eq("brand_id", brand.id);
  }
  if (query.minPrice !== undefined && Number.isFinite(query.minPrice)) {
    builder = builder.gte("price", Math.max(0, query.minPrice));
  }
  if (query.maxPrice !== undefined && Number.isFinite(query.maxPrice)) {
    builder = builder.lte("price", Math.max(0, query.maxPrice));
  }

  switch (query.sort ?? "newest") {
    case "price_asc":
      builder = builder.order("price", { ascending: true }).order("id");
      break;
    case "price_desc":
      builder = builder.order("price", { ascending: false }).order("id");
      break;
    case "name_asc":
      builder = builder.order("name", { ascending: true }).order("id");
      break;
    default:
      builder = builder.order("created_at", { ascending: false }).order("id");
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await builder.range(from, from + PAGE_SIZE - 1);
  if (error) {
    console.error("listProducts failed:", error.message);
    return { items: [], total: 0, page: 1, pageCount: 0 };
  }
  const total = count ?? 0;
  return {
    items: (data ?? []) as unknown as ProductListItem[],
    total,
    page,
    pageCount: Math.ceil(total / PAGE_SIZE),
  };
}

export interface ProductDetail extends ProductListItem {
  description: string | null;
  product_price_tiers: Array<Pick<ProductPriceTier, "min_qty" | "unit_price">>;
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, sku, slug, name, description, price, stock_status, moq, active, images, category_id, brand_id, created_at, categories(slug, name, icon), brands(slug, name), product_price_tiers(min_qty, unit_price)",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("getProductBySlug failed:", error.message);
    return null;
  }
  return (data as unknown as ProductDetail) ?? null;
}

export async function listCategories(): Promise<Category[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, icon, sort")
    .order("sort");
  if (error) {
    console.error("listCategories failed:", error.message);
    return [];
  }
  return (data ?? []) as Category[];
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("categories")
    .select("id, slug, name, icon, sort")
    .eq("slug", slug)
    .maybeSingle();
  return (data as Category) ?? null;
}

export async function listBrands(): Promise<Brand[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("brands")
    .select("id, slug, name")
    .order("name");
  if (error) {
    console.error("listBrands failed:", error.message);
    return [];
  }
  return (data ?? []) as Brand[];
}

export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("brands")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();
  return (data as Brand) ?? null;
}
