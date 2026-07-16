import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import type { OrderStatus, PaymentProof } from "@/lib/db-types";
import { OrderStatusBadge } from "@/components/ui/badge";
import { ActionForm } from "@/components/admin/action-form";
import { ProofRejectButton } from "@/components/admin/proof-reject-button";
import { fmtBytes, fmtDateTime } from "@/components/admin/format";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { reviewProofAction } from "@/server/actions/admin/orders";

export const metadata = { title: "Proof review" };

type ProofWithOrder = PaymentProof & {
  orders: {
    id: string;
    order_ref: string;
    customer_name: string;
    status: OrderStatus;
    total: number;
  } | null;
};

export default async function AdminProofsPage() {
  await requireAdmin();
  const service = supabaseService();

  const { data, error } = await service
    .from("payment_proofs")
    .select("*, orders(id, order_ref, customer_name, status, total)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) console.error("proof queue query failed:", error.message);
  const proofs = (data ?? []) as unknown as ProofWithOrder[];

  return (
    <div className="rise-in">
      <PageHeader
        title="Proof review"
        description={`${proofs.length} pending proof(s) — newest first. Approving marks the order Paid and emails the final receipt.`}
      />

      {proofs.length === 0 ? (
        <EmptyState
          title="Queue is clear"
          hint="New payment screenshots appear here as soon as customers upload them."
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {proofs.map((p) => (
            <li
              key={p.id}
              className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3"
            >
              <a
                href={`/api/admin/proofs/${p.id}/file`}
                target="_blank"
                rel="noopener"
                className="block shrink-0"
                title="Open full size"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/admin/proofs/${p.id}/file`}
                  alt={`Payment proof for order ${p.orders?.order_ref ?? ""}`}
                  className="h-32 w-32 rounded-lg border border-gray-200 object-cover"
                />
              </a>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {p.orders ? (
                    <Link
                      href={`/admin/orders/${p.orders.id}`}
                      className="text-sm font-semibold text-brand-700 hover:underline"
                    >
                      {p.orders.order_ref}
                    </Link>
                  ) : (
                    <span className="text-sm text-gray-400">Order deleted</span>
                  )}
                  {p.orders && <OrderStatusBadge status={p.orders.status} />}
                </div>
                <p className="mt-0.5 truncate text-sm text-gray-600">
                  {p.orders?.customer_name ?? "—"}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Uploaded {fmtDateTime(p.created_at)} · {fmtBytes(p.size_bytes)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ActionForm
                    action={reviewProofAction}
                    submitLabel="Approve & mark paid"
                    confirmMessage="Approve this proof? The order is marked Paid and the final receipt is emailed."
                  >
                    <input type="hidden" name="proofId" value={p.id} />
                    <input type="hidden" name="decision" value="approved" />
                  </ActionForm>
                  <ProofRejectButton proofId={p.id} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
