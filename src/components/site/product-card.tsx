import Link from "next/link";
import { CardAddToCart } from "@/components/site/card-add-to-cart";
import { CatalogImage } from "@/components/site/catalog-image";
import type { ProductListItem } from "@/lib/catalog";
import { publicImageUrl } from "@/lib/image-url";
import { formatEgp, toPiasters } from "@/lib/money";

/**
 * Catalog/product grid card. The image + name link to the product page; the
 * footer holds an inline quantity + add-to-cart control that never navigates.
 */
export function ProductCard({ product }: { product: ProductListItem }) {
  const imagePath =
    product.images?.[0] ?? `_category/${product.categories?.slug ?? "other"}.png`;

  return (
    <div className="group flex w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-brand-300 hover:shadow-md">
      <Link href={`/product/${product.slug}`} className="flex flex-1 flex-col">
        <div className="aspect-square w-full overflow-hidden bg-gray-50">
          <CatalogImage
            src={publicImageUrl(imagePath)}
            alt={product.name}
            icon={product.categories?.icon}
            className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
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
          {product.moq > 1 && (
            <span className="text-xs text-gray-500">MOQ {product.moq.toLocaleString("en-US")}</span>
          )}
        </div>
      </Link>

      <div className="border-t border-gray-100 p-3 sm:p-4">
        <CardAddToCart
          productId={product.id}
          moq={product.moq}
          outOfStock={product.stock_status === "out_of_stock"}
        />
      </div>
    </div>
  );
}
