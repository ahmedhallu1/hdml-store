import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/catalog";
import { publicImageUrl } from "@/lib/image-url";
import { formatEgp, toPiasters } from "@/lib/money";
import { getSiteSettings } from "@/lib/settings";
import { AddToCart } from "@/components/site/add-to-cart";
import { CatalogImage } from "@/components/site/catalog-image";
import { SimilarProducts } from "@/components/site/similar-products";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.name,
    description: `Buy ${product.name} wholesale from HDML — bulk prices in EGP, delivered across Egypt.`,
  };
}

export default async function ProductPage(props: Props) {
  const { slug } = await props.params;
  const [product, settings] = await Promise.all([getProductBySlug(slug), getSiteSettings()]);
  if (!product) notFound();

  const imagePath =
    product.images?.[0] ?? `_category/${product.categories?.slug ?? "other"}.png`;
  const basePiasters = toPiasters(String(product.price));
  const tiers = [...(product.product_price_tiers ?? [])].sort((a, b) => a.min_qty - b.min_qty);
  const showBaseTierRow = tiers.length > 0 && tiers[0].min_qty > product.moq;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-gray-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-brand-700">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          {product.categories && (
            <>
              <li>
                <Link href={`/category/${product.categories.slug}`} className="hover:text-brand-700">
                  {product.categories.name}
                </Link>
              </li>
              <li aria-hidden>/</li>
            </>
          )}
          <li aria-current="page" className="line-clamp-1 font-medium text-gray-900">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {/* Image */}
        <div className="mx-auto w-full max-w-sm">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <CatalogImage
              src={publicImageUrl(imagePath)}
              alt={product.name}
              icon={product.categories?.icon}
              className="aspect-square w-full object-contain p-4"
            />
          </div>
        </div>

        {/* Details */}
        <div className="min-w-0 space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
              <span>SKU: {product.sku}</span>
              {product.brands && (
                <Link
                  href={`/catalog?brand=${encodeURIComponent(product.brands.slug)}`}
                  className="font-medium text-brand-700 hover:text-brand-600"
                >
                  {product.brands.name}
                </Link>
              )}
              {product.categories && (
                <Link
                  href={`/category/${product.categories.slug}`}
                  className="text-gray-500 hover:text-brand-700"
                >
                  {product.categories.name}
                </Link>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              {product.name}
            </h1>
          </div>

          <div>
            <p className="text-3xl font-bold text-brand-800">{formatEgp(basePiasters)}</p>
            <p className="mt-1 text-xs text-gray-500">{settings.ordering.vat_note}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {product.stock_status === "out_of_stock" && (
              <span className="text-sm font-medium text-red-600">Out of stock</span>
            )}
            {product.moq > 1 && (
              <span className="text-sm text-gray-600">
                Minimum order quantity: {product.moq.toLocaleString("en-US")}
              </span>
            )}
          </div>

          {product.stock_status === "confirm_availability" && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Availability for this item is confirmed after you place your order — we check stock
              with our suppliers and contact you before payment verification if anything changes.
            </p>
          )}

          {tiers.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Wholesale pricing</h2>
              <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    Wholesale price tiers — unit price by minimum quantity
                  </caption>
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600">
                      <th scope="col" className="px-4 py-2 font-medium">
                        Quantity
                      </th>
                      <th scope="col" className="px-4 py-2 font-medium">
                        Unit price
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {showBaseTierRow && (
                      <tr>
                        <td className="px-4 py-2 text-gray-700">
                          {product.moq.toLocaleString("en-US")}+
                        </td>
                        <td className="px-4 py-2 font-medium text-gray-900">
                          {formatEgp(basePiasters)}
                        </td>
                      </tr>
                    )}
                    {tiers.map((tier) => (
                      <tr key={tier.min_qty}>
                        <td className="px-4 py-2 text-gray-700">
                          {tier.min_qty.toLocaleString("en-US")}+
                        </td>
                        <td className="px-4 py-2 font-medium text-gray-900">
                          {formatEgp(toPiasters(String(tier.unit_price)))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <AddToCart
            productId={product.id}
            moq={product.moq}
            outOfStock={product.stock_status === "out_of_stock"}
          />

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            <p className="font-medium text-gray-800">Delivery</p>
            <p className="mt-1">
              {settings.delivery.regions} — {settings.delivery.time}. {settings.delivery.fee_note}
            </p>
          </div>

          {product.description && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Description</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700">
                {product.description}
              </p>
            </div>
          )}
        </div>
      </div>

      <SimilarProducts
        categoryId={product.category_id}
        categorySlug={product.categories?.slug}
        excludeId={product.id}
      />
    </div>
  );
}
