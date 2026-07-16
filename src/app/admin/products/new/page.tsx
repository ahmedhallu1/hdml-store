import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import type { Brand, Category } from "@/lib/db-types";
import { ProductForm } from "@/components/admin/product-form";
import { Card, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "New product" };

export default async function AdminNewProductPage() {
  await requireAdmin();
  const service = supabaseService();

  const [{ data: cats }, { data: brands }] = await Promise.all([
    service.from("categories").select("id, name").order("sort"),
    service.from("brands").select("id, name").order("name"),
  ]);

  return (
    <div className="rise-in">
      <PageHeader
        title="New product"
        description="SKU and slug are generated automatically from the name and price."
      />
      <Card>
        <ProductForm
          product={null}
          categories={(cats ?? []) as Category[]}
          brands={(brands ?? []) as Brand[]}
        />
      </Card>
    </div>
  );
}
