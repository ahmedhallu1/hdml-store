import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/site/pagination";
import { ActionForm } from "@/components/admin/action-form";
import { egp } from "@/components/admin/format";
import { EmptyState, PageHeader, TableShell, Td, Th } from "@/components/admin/ui";
import { activateProductAsIsAction } from "@/server/actions/admin/products";

export const metadata = { title: "Needs review" };

const PAGE_SIZE = 50;

interface Row {
  id: string;
  name: string;
  original_title: string;
  sku: string;
  price: number;
  active: boolean;
  review_reason: string | null;
}

export default async function AdminReviewQueuePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await props.searchParams;
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);

  const service = supabaseService();
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await service
    .from("products")
    .select("id, name, original_title, sku, price, active, review_reason", { count: "exact" })
    .eq("needs_review", true)
    .order("name", { ascending: true })
    .order("price", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);
  if (error) console.error("review queue query failed:", error.message);

  const rows = (data ?? []) as Row[];
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="rise-in">
      <PageHeader
        title="Needs review"
        description={`${total.toLocaleString("en-US")} flagged product(s) — conflicting price variants, mojibake names and generic titles from the import. Sorted by name so price variants sit together.`}
      />

      {rows.length === 0 ? (
        <EmptyState title="Nothing to review" hint="All imported flags are resolved." />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th className="text-right">Price</Th>
              <Th>Reason</Th>
              <Th>State</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <Td className="max-w-md">
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="line-clamp-2 font-medium text-brand-700 hover:underline"
                  >
                    {p.name}
                  </Link>
                  {p.original_title !== p.name && (
                    <span className="mt-0.5 line-clamp-1 text-xs text-gray-400" title={p.original_title}>
                      was: {p.original_title}
                    </span>
                  )}
                  <span className="text-xs text-gray-300">{p.sku}</span>
                </Td>
                <Td className="whitespace-nowrap text-right font-medium">{egp(p.price)}</Td>
                <Td className="max-w-56">
                  <span className="line-clamp-2 text-xs text-amber-700" title={p.review_reason ?? ""}>
                    {p.review_reason ?? "—"}
                  </span>
                </Td>
                <Td>
                  {p.active ? (
                    <Badge tone="green">Active</Badge>
                  ) : (
                    <Badge tone="gray">Inactive</Badge>
                  )}
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="inline-flex h-8 items-center rounded-md border border-brand-200 px-3 text-sm font-medium text-brand-800 hover:bg-brand-50"
                    >
                      Edit
                    </Link>
                    <ActionForm
                      action={activateProductAsIsAction}
                      submitLabel="Activate as-is"
                      submitVariant="secondary"
                      confirmMessage="Activate this product exactly as imported and clear the review flag?"
                      hideMessage
                    >
                      <input type="hidden" name="productId" value={p.id} />
                    </ActionForm>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <div className="mt-4">
        <Pagination page={page} pageCount={pageCount} basePath="/admin/products/review" />
      </div>
    </div>
  );
}
