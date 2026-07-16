import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import type { Category, StockStatus } from "@/lib/db-types";
import { Badge, StockBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/site/pagination";
import { ActionForm } from "@/components/admin/action-form";
import { egp } from "@/components/admin/format";
import { EmptyState, PageHeader, TableShell, Td, Th } from "@/components/admin/ui";
import { toggleProductActiveAction } from "@/server/actions/admin/products";

export const metadata = { title: "Products" };

const PAGE_SIZE = 50;
const STATUS_FILTERS = ["all", "active", "inactive", "needs_review"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

interface Row {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock_status: StockStatus;
  moq: number;
  active: boolean;
  needs_review: boolean;
  categories: { name: string } | null;
}

function sanitizeSearch(q: string): string {
  return q.replace(/[\\%_(),]/g, " ").trim().slice(0, 80);
}

export default async function AdminProductsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await props.searchParams;
  const status: StatusFilter = STATUS_FILTERS.includes(sp.status as StatusFilter)
    ? (sp.status as StatusFilter)
    : "all";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const category = typeof sp.category === "string" ? sp.category : "";
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);

  const service = supabaseService();
  const { data: cats } = await service
    .from("categories")
    .select("id, slug, name, icon, sort")
    .order("sort");
  const categories = (cats ?? []) as Category[];

  let query = service
    .from("products")
    .select("id, name, sku, price, stock_status, moq, active, needs_review, categories(name)", {
      count: "exact",
    });
  if (status === "active") query = query.eq("active", true);
  if (status === "inactive") query = query.eq("active", false);
  if (status === "needs_review") query = query.eq("needs_review", true);
  if (category && /^[0-9a-f-]{36}$/i.test(category)) query = query.eq("category_id", category);
  const safeQ = sanitizeSearch(q);
  if (safeQ) query = query.or(`name.ilike.%${safeQ}%,sku.ilike.%${safeQ}%`);

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);
  if (error) console.error("admin products query failed:", error.message);

  const products = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filterParams: Record<string, string> = {};
  if (status !== "all") filterParams.status = status;
  if (q) filterParams.q = q;
  if (category) filterParams.category = category;

  return (
    <div className="rise-in">
      <PageHeader
        title="Products"
        description={`${total.toLocaleString("en-US")} product(s)`}
        actions={
          <>
            <a
              href="/api/admin/products/export"
              className="inline-flex h-8 items-center rounded-md border border-brand-200 px-3 text-sm font-medium text-brand-800 hover:bg-brand-50"
            >
              Export CSV
            </a>
            <Link
              href="/admin/products/import"
              className="inline-flex h-8 items-center rounded-md border border-brand-200 px-3 text-sm font-medium text-brand-800 hover:bg-brand-50"
            >
              Import CSV
            </Link>
            <Link
              href="/admin/products/new"
              className="inline-flex h-8 items-center rounded-md bg-brand-700 px-3 text-sm font-medium text-white hover:bg-brand-600"
            >
              New product
            </Link>
          </>
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2" aria-label="Filter products">
        <div className="min-w-48 flex-1 sm:max-w-xs">
          <label htmlFor="p-q" className="mb-1 block text-xs font-medium text-gray-600">
            Search
          </label>
          <input
            id="p-q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Name or SKU…"
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="p-status" className="mb-1 block text-xs font-medium text-gray-600">
            Status
          </label>
          <select
            id="p-status"
            name="status"
            defaultValue={status}
            className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="needs_review">Needs review</option>
          </select>
        </div>
        <div>
          <label htmlFor="p-category" className="mb-1 block text-xs font-medium text-gray-600">
            Category
          </label>
          <select
            id="p-category"
            name="category"
            defaultValue={category}
            className="h-9 max-w-48 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" variant="secondary" className="h-9">
          Apply
        </Button>
        {(q || status !== "all" || category) && (
          <Link
            href="/admin/products"
            className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-gray-500 hover:text-brand-700"
          >
            Clear
          </Link>
        )}
      </form>

      {products.length === 0 ? (
        <EmptyState title="No products match" hint="Try clearing the filters." />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>SKU</Th>
              <Th className="text-right">Price</Th>
              <Th>Category</Th>
              <Th>Stock</Th>
              <Th className="text-right">MOQ</Th>
              <Th>Flags</Th>
              <Th>Active</Th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <Td className="max-w-sm">
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="line-clamp-2 font-medium text-brand-700 hover:underline"
                  >
                    {p.name}
                  </Link>
                </Td>
                <Td className="whitespace-nowrap text-xs text-gray-400">{p.sku}</Td>
                <Td className="whitespace-nowrap text-right font-medium">{egp(p.price)}</Td>
                <Td className="whitespace-nowrap text-gray-500">{p.categories?.name ?? "—"}</Td>
                <Td>
                  <StockBadge status={p.stock_status} />
                </Td>
                <Td className="text-right">{p.moq}</Td>
                <Td>
                  {p.needs_review ? (
                    <Badge tone="amber">Needs review</Badge>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </Td>
                <Td>
                  <ActionForm
                    action={toggleProductActiveAction}
                    submitLabel={p.active ? "Deactivate" : "Activate"}
                    submitVariant={p.active ? "outline" : "secondary"}
                    hideMessage
                  >
                    <input type="hidden" name="productId" value={p.id} />
                    <input type="hidden" name="active" value={p.active ? "false" : "true"} />
                  </ActionForm>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <div className="mt-4">
        <Pagination
          page={page}
          pageCount={pageCount}
          basePath="/admin/products"
          searchParams={filterParams}
        />
      </div>
    </div>
  );
}
