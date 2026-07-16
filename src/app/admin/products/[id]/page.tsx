import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { piastersToDecimalString, toPiasters } from "@/lib/money";
import type { Brand, Category, Product, ProductPriceTier } from "@/lib/db-types";
import { Badge } from "@/components/ui/badge";
import { DeleteProductButton } from "@/components/admin/delete-product-button";
import { ProductForm, type ProductFormInitial } from "@/components/admin/product-form";
import { Card, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Edit product" };

export default async function AdminEditProductPage(props: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const service = supabaseService();
  const [{ data: productRow }, { data: cats }, { data: brands }, { data: tierRows }] =
    await Promise.all([
      service.from("products").select("*").eq("id", id).maybeSingle(),
      service.from("categories").select("id, name").order("sort"),
      service.from("brands").select("id, name").order("name"),
      service
        .from("product_price_tiers")
        .select("id, product_id, min_qty, unit_price")
        .eq("product_id", id)
        .order("min_qty"),
    ]);

  const product = productRow as Product | null;
  if (!product) notFound();

  const initial: ProductFormInitial = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description ?? "",
    price: piastersToDecimalString(toPiasters(String(product.price))),
    categoryId: product.category_id,
    brandId: product.brand_id,
    stockStatus: product.stock_status,
    moq: product.moq,
    active: product.active,
    needsReview: product.needs_review,
    reviewReason: product.review_reason,
    images: product.images ?? [],
    tiers: ((tierRows ?? []) as ProductPriceTier[]).map((t) => ({
      minQty: t.min_qty,
      unitPrice: piastersToDecimalString(toPiasters(String(t.unit_price))),
    })),
  };

  return (
    <div className="rise-in">
      <PageHeader
        title={product.name}
        description={`SKU ${product.sku}`}
        actions={
          <>
            {product.needs_review && <Badge tone="amber">Needs review</Badge>}
            {!product.active && <Badge tone="gray">Inactive</Badge>}
            {product.active && (
              <Link
                href={`/product/${product.slug}`}
                target="_blank"
                rel="noopener"
                className="rounded-lg border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                View in store ↗
              </Link>
            )}
          </>
        }
      />

      {product.needs_review && product.original_title !== product.name && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Original imported title: <span className="font-medium">{product.original_title}</span>
        </p>
      )}

      <Card>
        <ProductForm
          product={initial}
          categories={(cats ?? []) as Category[]}
          brands={(brands ?? []) as Brand[]}
        />
      </Card>

      <Card title="Danger zone" className="mt-4 border-red-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            Deleting removes the product and its price tiers. Products referenced by orders are
            deactivated instead.
          </p>
          <DeleteProductButton productId={product.id} name={product.name} />
        </div>
      </Card>
    </div>
  );
}
