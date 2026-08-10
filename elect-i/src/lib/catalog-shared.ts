import type { StockStatus, VerificationLevel } from "@/lib/db-types";

/**
 * Catalog shapes and constants shared by server queries and client controls.
 *
 * These live apart from `catalog.ts` because that module is `server-only`:
 * a client component importing a runtime value from it (SORTS, STOCK_STATUSES)
 * would drag the Supabase server client into the browser bundle and fail the
 * build. Types alone are erased and would be fine — the constants are not.
 */

export const PAGE_SIZE = 24;

export const SORTS = ["relevance", "price_asc", "price_desc", "newest"] as const;
export type CatalogSort = (typeof SORTS)[number];

export const STOCK_STATUSES: StockStatus[] = [
  "in_stock",
  "made_to_order",
  "confirm_availability",
  "out_of_stock",
];

export interface CatalogQuery {
  q: string;
  /** Category slug, or "" for every category. */
  category: string;
  /** Supplier slug, or "" for every supplier. */
  supplier: string;
  /** Whole-dollar bounds on the list price; null means unbounded. */
  minUsd: number | null;
  maxUsd: number | null;
  stock: StockStatus | null;
  sort: CatalogSort;
  page: number;
}

export interface SupplierRef {
  slug: string;
  name: string;
  country: string | null;
  verification: VerificationLevel;
  leadTimeDays: number | null;
}

export interface CategoryRef {
  slug: string;
  name: string;
  groupKey: string;
}

export interface ProductListing {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string | null;
  image: string | null;
  images: string[];
  listCents: number;
  /** What THIS visitor pays per unit at list quantity, after their tier. */
  yourCents: number;
  /** listCents - yourCents, per unit. Zero for buyers. */
  savingCents: number;
  moq: number;
  effectiveMoq: number;
  stockStatus: StockStatus;
  leadTimeDays: number | null;
  unit: string;
  featured: boolean;
  supplier: SupplierRef | null;
  category: CategoryRef | null;
}

export interface PriceLadderRow {
  minQty: number;
  listCents: number;
  yourCents: number;
}

export interface ProductDetail extends ProductListing {
  specs: Record<string, string>;
  ladder: PriceLadderRow[];
  /** Per-unit saving a buyer would gain by moving to the Merchant tier. */
  upgradeSavingCents: number;
}

export interface CatalogPage {
  items: ProductListing[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** True when the query itself failed (as opposed to matching nothing). */
  degraded: boolean;
}

export interface CategoryOption {
  id: string;
  slug: string;
  name: string;
  groupKey: string;
  parentId: string | null;
}

export interface SupplierOption extends SupplierRef {
  id: string;
  city: string | null;
  description: string | null;
  responseRate: number | null;
  productCount: number | null;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;
