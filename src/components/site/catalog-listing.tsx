import Link from "next/link";
import {
  listBrands,
  listCategories,
  listProducts,
  type CatalogSort,
} from "@/lib/catalog";
import type { Category } from "@/lib/db-types";
import { CatalogFilters } from "@/components/site/catalog-filters";
import { Pagination } from "@/components/site/pagination";
import { ProductCard } from "@/components/site/product-card";

const SORTS: readonly CatalogSort[] = ["newest", "price_asc", "price_desc", "name_asc"];

export interface CatalogParams {
  q?: string;
  category?: string;
  brand?: string;
  min?: number;
  max?: number;
  sort: CatalogSort;
  page: number;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Coerce untrusted ?q=&category=… query params into safe, typed values. */
export function parseCatalogParams(sp: RawSearchParams): CatalogParams {
  const text = (v: string | string[] | undefined): string | undefined => {
    const s = first(v)?.trim();
    return s ? s.slice(0, 120) : undefined;
  };
  const egp = (v: string | string[] | undefined): number | undefined => {
    const n = Number.parseInt(first(v) ?? "", 10);
    return Number.isSafeInteger(n) && n >= 0 && n <= 99_999_999 ? n : undefined;
  };
  const sortRaw = first(sp.sort);
  const pageRaw = Number.parseInt(first(sp.page) ?? "", 10);

  return {
    q: text(sp.q),
    category: text(sp.category),
    brand: text(sp.brand),
    min: egp(sp.min),
    max: egp(sp.max),
    sort: SORTS.includes(sortRaw as CatalogSort) ? (sortRaw as CatalogSort) : "newest",
    page: Number.isSafeInteger(pageRaw) && pageRaw >= 1 ? Math.min(pageRaw, 100_000) : 1,
  };
}

/**
 * Filter bar + product grid + pagination, shared by /catalog and
 * /category/[slug] (where the category is locked and hidden from the form).
 */
export async function CatalogListing({
  params,
  basePath,
  lockedCategory,
}: {
  params: CatalogParams;
  basePath: string;
  lockedCategory?: Category;
}) {
  const [categories, brands, result] = await Promise.all([
    lockedCategory ? Promise.resolve([]) : listCategories(),
    listBrands(),
    listProducts({
      q: params.q,
      categorySlug: lockedCategory ? lockedCategory.slug : params.category,
      brandSlug: params.brand,
      minPrice: params.min,
      maxPrice: params.max,
      sort: params.sort,
      page: params.page,
    }),
  ]);

  const preserved: Record<string, string> = {};
  if (params.q) preserved.q = params.q;
  if (!lockedCategory && params.category) preserved.category = params.category;
  if (params.brand) preserved.brand = params.brand;
  if (params.min !== undefined) preserved.min = String(params.min);
  if (params.max !== undefined) preserved.max = String(params.max);
  if (params.sort !== "newest") preserved.sort = params.sort;

  const hasFilters =
    Boolean(params.q) ||
    Boolean(!lockedCategory && params.category) ||
    Boolean(params.brand) ||
    params.min !== undefined ||
    params.max !== undefined;

  return (
    <div className="space-y-6">
      <CatalogFilters
        action={basePath}
        categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
        brands={brands.map((b) => ({ slug: b.slug, name: b.name }))}
        values={{
          q: params.q,
          category: lockedCategory ? undefined : params.category,
          brand: params.brand,
          min: params.min,
          max: params.max,
          sort: params.sort,
        }}
        hideCategory={Boolean(lockedCategory)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600" role="status">
          {result.total === 0
            ? "No products found"
            : `${result.total.toLocaleString("en-US")} product${result.total === 1 ? "" : "s"}`}
          {result.pageCount > 1 && ` — page ${result.page} of ${result.pageCount}`}
        </p>
        {hasFilters && (
          <Link href={basePath} className="text-sm font-medium text-brand-700 hover:text-brand-600">
            Clear filters
          </Link>
        )}
      </div>

      {result.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
          <p className="text-base font-medium text-gray-900">
            {hasFilters ? "Nothing matches these filters" : "No products here yet"}
          </p>
          <p className="mt-2 text-sm text-gray-600">
            {hasFilters
              ? "Try a broader search term or remove some filters."
              : "Please check back soon — the catalog is updated regularly."}
          </p>
          {hasFilters && (
            <Link
              href={basePath}
              className="mt-6 inline-flex h-10 items-center rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-600"
            >
              Clear all filters
            </Link>
          )}
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {result.items.map((product) => (
              <li key={product.id} className="flex">
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            basePath={basePath}
            searchParams={preserved}
          />
        </>
      )}
    </div>
  );
}
