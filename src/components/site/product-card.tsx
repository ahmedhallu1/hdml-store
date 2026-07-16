import Link from "next/link";
import { StockBadge } from "@/components/ui/badge";
import { ProductPlaceholder } from "@/components/site/product-placeholder";
import type { ProductListItem } from "@/lib/catalog";
import { publicImageUrl } from "@/lib/image-url";
import { formatEgp, toPiasters } from "@/lib/money";

/** Catalog/product grid card. Whole card links to the product page. */
export function ProductCard({ product }: { product: ProductListItem }) {
  const image = product.images?.[0];

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-brand-300 hover:shadow-md"
    >
      <div className="aspect-square w-full overflow-hidden bg-gray-50">
        {image ? (
          // Remote storage images: plain <img> keeps the free tier free of
          // image-optimizer invocations.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={publicImageUrl(image)}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <ProductPlaceholder icon={product.categories?.icon} label={product.name} />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        {product.brands && (
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {product.brands.name}
          </p>
        )}
        <h3 className="line-clamp-2 text-sm font-medium text-gray-900 group-hover:text-brand-700">
          {product.name}
        </h3>
        <p className="mt-auto pt-1 text-base font-semibold text-brand-800">
          {formatEgp(toPiasters(String(product.price)))}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <StockBadge status={product.stock_status} />
          {product.moq > 1 && (
            <span className="text-xs text-gray-500">MOQ {product.moq.toLocaleString("en-US")}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
