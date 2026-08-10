import type { Dictionary } from "@/i18n";
import type { StockStatus, VerificationLevel } from "@/lib/db-types";
import type { Tier } from "@/lib/tiers";
import type { CatalogSort } from "@/lib/catalog-shared";

/**
 * Enum → copy. Kept in one place so a badge, a filter option and a table cell
 * can never disagree about what `made_to_order` is called.
 */

export function stockLabel(status: StockStatus, dict: Dictionary): string {
  switch (status) {
    case "in_stock":
      return dict.catalog.inStock;
    case "made_to_order":
      return dict.catalog.madeToOrder;
    case "out_of_stock":
      return dict.catalog.outOfStock;
    default:
      return dict.catalog.confirmAvailability;
  }
}

export function verificationLabel(level: VerificationLevel, dict: Dictionary): string {
  switch (level) {
    case "verified":
      return dict.suppliers.levelVerified;
    case "audited":
      return dict.suppliers.levelAudited;
    case "premium_manufacturer":
      return dict.suppliers.levelPremiumManufacturer;
    case "authorized_distributor":
      return dict.suppliers.levelAuthorizedDistributor;
    default:
      return dict.suppliers.levelUnverified;
  }
}

export function sortLabel(sort: CatalogSort, dict: Dictionary): string {
  switch (sort) {
    case "price_asc":
      return dict.catalog.sortPriceAsc;
    case "price_desc":
      return dict.catalog.sortPriceDesc;
    case "newest":
      return dict.catalog.sortNewest;
    default:
      return dict.catalog.sortRelevance;
  }
}

export function tierLabel(tier: Tier, dict: Dictionary): string {
  switch (tier) {
    case "merchant":
      return dict.tiers.merchantName;
    case "elite":
      return dict.tiers.eliteName;
    default:
      return dict.tiers.buyerName;
  }
}

/** Fill `{name}` placeholders in a dictionary string. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
