import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { formatEgp, sumPiasters, toPiasters } from "@/lib/money";
import { ORDER_STATUS_LABELS, type Order, type OrderStatus } from "@/lib/db-types";
import { OrderStatusBadge } from "@/components/ui/badge";
import { egp, fmtDateTime } from "@/components/admin/format";
import { EmptyState, PageHeader, StatCard, TableShell, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Dashboard" };

// "fulfilled" is intentionally omitted — HDML's flow ends at "paid" (delivery
// is completed off-site), so no order ever reaches that legacy status.
const STATUSES: OrderStatus[] = [
  "awaiting_payment",
  "awaiting_verification",
  "paid",
  "cancelled",
];

async function confirmedRevenuePiasters(): Promise<number> {
  const service = supabaseService();
  let total = 0;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await service
      .from("orders")
      .select("total")
      .in("status", ["paid", "fulfilled"])
      .order("id")
      .range(from, from + 999);
    if (error) {
      console.error("revenue query failed:", error.message);
      return total;
    }
    total = sumPiasters([
      total,
      ...((data ?? []) as Array<{ total: number }>).map((r) => toPiasters(String(r.total))),
    ]);
    if (!data || data.length < 1000) break;
  }
  return total;
}

export default async function AdminDashboardPage() {
  await requireAdmin();
  const service = supabaseService();

  const [statusCounts, revenue, proofsPending, activeProducts, needsReview, recent] =
    await Promise.all([
      Promise.all(
        STATUSES.map(async (s) => {
          const { count } = await service
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("status", s);
          return [s, count ?? 0] as const;
        }),
      ),
      confirmedRevenuePiasters(),
      service
        .from("payment_proofs")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      service
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("active", true),
      service
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("needs_review", true),
      service
        .from("orders")
        .select("id, order_ref, customer_name, created_at, total, status")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const recentOrders = (recent.data ?? []) as Order[];

  return (
    <div className="rise-in">
      <PageHeader title="Dashboard" description="Store health at a glance." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Confirmed revenue" value={formatEgp(revenue)} hint="Paid orders" />
        <StatCard
          label="Pending proofs"
          value={String(proofsPending.count ?? 0)}
          hint="Awaiting verification"
          href="/admin/proofs"
        />
        <StatCard
          label="Active products"
          value={(activeProducts.count ?? 0).toLocaleString("en-US")}
          href="/admin/products?status=active"
        />
        <StatCard
          label="Needs review"
          value={(needsReview.count ?? 0).toLocaleString("en-US")}
          hint="Imported flags to resolve"
          href="/admin/products/review"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {statusCounts.map(([status, count]) => (
          <StatCard
            key={status}
            label={ORDER_STATUS_LABELS[status]}
            value={String(count)}
            href={`/admin/orders?status=${status}`}
          />
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-gray-900">Recent orders</h2>
      {recentOrders.length === 0 ? (
        <EmptyState title="No orders yet" hint="New orders will appear here." />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Ref</Th>
              <Th>Customer</Th>
              <Th>Date</Th>
              <Th className="text-right">Total</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <Td>
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {o.order_ref}
                  </Link>
                </Td>
                <Td>{o.customer_name}</Td>
                <Td className="whitespace-nowrap text-gray-500">{fmtDateTime(o.created_at)}</Td>
                <Td className="whitespace-nowrap text-right font-medium">{egp(o.total)}</Td>
                <Td>
                  <OrderStatusBadge status={o.status} />
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
