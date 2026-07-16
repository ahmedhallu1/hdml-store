import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { ORDER_STATUS_LABELS, type Order, type OrderStatus, type ProofStatus } from "@/lib/db-types";
import { Badge, OrderStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/site/pagination";
import { egp, fmtDateTime } from "@/components/admin/format";
import { EmptyState, PageHeader, TableShell, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Orders" };

const PAGE_SIZE = 25;
const STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];

/** Make free text safe inside a PostgREST or(...ilike...) expression. */
function sanitizeSearch(q: string): string {
  return q.replace(/[\\%_(),]/g, " ").trim().slice(0, 80);
}

function proofSummary(statuses: ProofStatus[]): { label: string; tone: "amber" | "green" | "red" | "gray" } | null {
  if (statuses.length === 0) return null;
  if (statuses.includes("pending")) return { label: "Proof pending", tone: "amber" };
  if (statuses.includes("approved")) return { label: "Proof approved", tone: "green" };
  return { label: "Proof rejected", tone: "red" };
}

export default async function AdminOrdersPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await props.searchParams;
  const status = typeof sp.status === "string" && (STATUSES as string[]).includes(sp.status)
    ? (sp.status as OrderStatus)
    : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);

  const service = supabaseService();
  let query = service
    .from("orders")
    .select("id, order_ref, customer_name, email, created_at, total, status", { count: "exact" });
  if (status) query = query.eq("status", status);
  const safeQ = sanitizeSearch(q);
  if (safeQ) {
    query = query.or(
      `order_ref.ilike.%${safeQ}%,customer_name.ilike.%${safeQ}%,email.ilike.%${safeQ}%`,
    );
  }
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) console.error("admin orders query failed:", error.message);

  const orders = (data ?? []) as Order[];
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Proof states for the visible page in one query.
  const proofByOrder = new Map<string, ProofStatus[]>();
  if (orders.length > 0) {
    const { data: proofs } = await service
      .from("payment_proofs")
      .select("order_id, status")
      .in("order_id", orders.map((o) => o.id));
    for (const p of (proofs ?? []) as Array<{ order_id: string; status: ProofStatus }>) {
      const list = proofByOrder.get(p.order_id) ?? [];
      list.push(p.status);
      proofByOrder.set(p.order_id, list);
    }
  }

  const filterParams: Record<string, string> = {};
  if (status) filterParams.status = status;
  if (q) filterParams.q = q;

  return (
    <div className="rise-in">
      <PageHeader title="Orders" description={`${total.toLocaleString("en-US")} order(s)`} />

      <form
        method="get"
        className="mb-4 flex flex-wrap items-end gap-2"
        aria-label="Filter orders"
      >
        <div>
          <label htmlFor="order-status" className="mb-1 block text-xs font-medium text-gray-600">
            Status
          </label>
          <select
            id="order-status"
            name="status"
            defaultValue={status ?? ""}
            className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-48 flex-1 sm:max-w-xs">
          <label htmlFor="order-q" className="mb-1 block text-xs font-medium text-gray-600">
            Search
          </label>
          <input
            id="order-q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Ref, customer or email…"
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary" className="h-9">
          Apply
        </Button>
        {(status || q) && (
          <Link
            href="/admin/orders"
            className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-gray-500 hover:text-brand-700"
          >
            Clear
          </Link>
        )}
      </form>

      {orders.length === 0 ? (
        <EmptyState title="No orders match" hint="Try clearing the filters." />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Ref</Th>
              <Th>Customer</Th>
              <Th className="text-right">Total</Th>
              <Th>Status</Th>
              <Th>Proof</Th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const proof = proofSummary(proofByOrder.get(o.id) ?? []);
              return (
                <tr key={o.id} className="hover:bg-gray-50">
                  <Td className="whitespace-nowrap text-gray-500">{fmtDateTime(o.created_at)}</Td>
                  <Td>
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {o.order_ref}
                    </Link>
                  </Td>
                  <Td>
                    <span className="block max-w-56 truncate">{o.customer_name}</span>
                    <span className="block max-w-56 truncate text-xs text-gray-400">{o.email}</span>
                  </Td>
                  <Td className="whitespace-nowrap text-right font-medium">{egp(o.total)}</Td>
                  <Td>
                    <OrderStatusBadge status={o.status} />
                  </Td>
                  <Td>{proof ? <Badge tone={proof.tone}>{proof.label}</Badge> : <span className="text-xs text-gray-300">—</span>}</Td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      )}

      <div className="mt-4">
        <Pagination
          page={page}
          pageCount={pageCount}
          basePath="/admin/orders"
          searchParams={filterParams}
        />
      </div>
    </div>
  );
}
