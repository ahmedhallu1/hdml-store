import Link from "next/link";
import { listSimilarProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/site/product-card";

/**
 * "Similar products" rail shown below a product's details — up to 8 other
 * active products from the same category.
 */
export async function SimilarProducts({
  categoryId,
  categorySlug,
  excludeId,
}: {
  categoryId: string | null;
  categorySlug?: string;
  excludeId: string;
}) {
  if (!categoryId) return null;

  const products = await listSimilarProducts(categoryId, excludeId, 8);
  if (products.length === 0) return null;

  return (
    <section className="mt-12 border-t border-gray-200 pt-10">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight text-gray-900 sm:text-xl">
          Similar products
        </h2>
        {categorySlug && (
          <Link
            href={`/category/${categorySlug}`}
            className="shrink-0 text-sm font-medium text-brand-700 hover:text-brand-600"
          >
            View all
          </Link>
        )}
      </div>
      <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <li key={p.id} className="flex">
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}
