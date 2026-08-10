import Link from "next/link";
import { Badge, StockBadge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { formatDisplayPrice, type DisplayCurrency } from "@/lib/currency";
import type { ProductListing } from "@/lib/catalog-shared";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { ProductImage } from "./product-image";
import { fill, stockLabel } from "./labels";

/**
 * One result in the grid. The whole card is a single link — a wholesale buyer
 * scanning 24 results should never have to aim at a small target.
 *
 * `.spotlight` reads the pointer position published by the enclosing
 * SpotlightGroup, so a cursor-tracking rim light costs one shared listener for
 * the whole grid rather than one per card.
 */
export function ProductCard({
  product,
  lang,
  dict,
  display,
  priority = false,
}: {
  product: ProductListing;
  lang: Locale;
  dict: Dictionary;
  /** Visitor's display currency. The listing itself stays in USD cents. */
  display: DisplayCurrency;
  priority?: boolean;
}) {
  const discounted = product.savingCents > 0;
  const discountPct = discounted
    ? Math.round((product.savingCents / product.listCents) * 100)
    : 0;

  return (
    <Link
      href={`/${lang}/product/${product.slug}`}
      data-cursor="view:VIEW"
      className="panel panel-hover spotlight group flex h-full cursor-pointer flex-col overflow-hidden focus-visible:border-accent-400/60"
    >
      <div className="relative">
        <ProductImage
          src={product.image}
          alt={product.name}
          sku={product.sku}
          groupKey={product.category?.groupKey}
          categoryLabel={product.category?.name}
          priority={priority}
        />
        <span className="absolute left-2.5 top-2.5">
          <StockBadge status={product.stockStatus} label={stockLabel(product.stockStatus, dict)} />
        </span>
        <span className="absolute right-2.5 top-2.5 flex flex-col items-end gap-1.5">
          {product.featured ? (
            <Badge tone="accent">
              <Icon name="spark" className="size-3" />
            </Badge>
          ) : null}
          {discountPct > 0 ? (
            <span className="rounded-md border border-settled-500/30 bg-settled-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-settled-400">
              −{discountPct}%
            </span>
          ) : null}
        </span>
        {/* Fade the schematic/photo into the card body so there is no hard seam. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-obsidian-800/90 to-transparent"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="font-mono text-[11px] tracking-wider text-ink-500">{product.sku}</p>

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink-100 transition-colors duration-200 group-hover:text-accent-200">
          {product.name}
        </h3>

        {product.supplier ? (
          <p className="flex items-center gap-1.5 text-xs text-ink-500">
            <Icon name="factory" className="size-3.5 shrink-0" />
            <span className="truncate">{product.supplier.name}</span>
          </p>
        ) : null}

        <div className="mt-auto pt-2">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-lg font-semibold text-ink-50">
              {formatDisplayPrice(product.yourCents, display)}
            </span>
            <span className="text-[11px] text-ink-500">{dict.common.perUnit}</span>
            {discounted ? (
              <span className="font-mono text-xs text-ink-600 line-through">
                {formatDisplayPrice(product.listCents, display)}
              </span>
            ) : null}
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-500">
            <Icon name="package" className="size-3.5 shrink-0 text-ink-600" />
            {fill(dict.product.moqNote, { qty: product.effectiveMoq })}
          </p>
        </div>
      </div>
    </Link>
  );
}

/** Fixed-height skeleton matching the card, so loading states do not jump. */
export function ProductCardSkeleton() {
  return (
    <div className="panel overflow-hidden" aria-hidden="true">
      <div className="shimmer aspect-square w-full" />
      <div className="flex flex-col gap-2.5 p-4">
        <div className="shimmer h-3 w-20 rounded" />
        <div className="shimmer h-4 w-full rounded" />
        <div className="shimmer h-4 w-3/5 rounded" />
        <div className="shimmer mt-3 h-5 w-24 rounded" />
      </div>
    </div>
  );
}
