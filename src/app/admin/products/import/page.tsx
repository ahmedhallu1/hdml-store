import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { CsvImport } from "@/components/admin/csv-import";
import { Card, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Import products" };

export default async function AdminProductImportPage() {
  await requireAdmin();

  return (
    <div className="rise-in">
      <PageHeader
        title="Import products (CSV)"
        description="Rows with a sku update the existing product (only the columns you provide); rows without a sku create new products. Max 5,000 rows."
        actions={
          <>
            <a
              href="/api/admin/products/export"
              className="inline-flex h-8 items-center rounded-md border border-brand-200 px-3 text-sm font-medium text-brand-800 hover:bg-brand-50"
            >
              Export current catalog
            </a>
            <Link
              href="/admin/imports"
              className="inline-flex h-8 items-center rounded-md border border-gray-200 px-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Past imports
            </Link>
          </>
        }
      />

      <Card>
        <CsvImport />
      </Card>

      <Card title="Expected columns" className="mt-4">
        <p className="text-sm text-gray-600">
          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
            sku, slug, name, price, category_slug, brand_name, stock_status, moq, active,
            needs_review, review_reason, images
          </code>
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-500">
          <li>
            <span className="font-medium text-gray-700">sku</span> optional — present: update by
            SKU; absent: create (SKU is derived from name + price, so re-imports never duplicate).
          </li>
          <li>
            <span className="font-medium text-gray-700">price</span> in EGP, e.g. 1499.50.
          </li>
          <li>
            <span className="font-medium text-gray-700">images</span> pipe-separated paths or URLs
            (max 10). <span className="font-medium text-gray-700">slug</span> is ignored — slugs
            are managed automatically.
          </li>
          <li>
            <span className="font-medium text-gray-700">category_slug</span> must already exist
            (manage under Categories &amp; Brands); unknown brands are created automatically.
          </li>
          <li>
            New rows default to active unless <span className="font-medium text-gray-700">needs_review</span>{" "}
            is true. The export above produces exactly this format.
          </li>
        </ul>
      </Card>
    </div>
  );
}
