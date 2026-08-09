import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { PROOF_BUCKET } from "@/lib/proof-file";
import type { Order, PaymentProof } from "@/lib/db-types";
import { Badge } from "@/components/ui/badge";
import { fmtBytes, fmtDateTime } from "@/components/admin/format";
import { Card, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Payment proof" };

const TONES = { pending: "amber", approved: "green", rejected: "red" } as const;

/**
 * Payment proof viewer, reachable from every order — including the ones that
 * never had a proof, or whose stored file is gone.
 *
 * Older orders were reconciled straight from the bank statements and the
 * screenshots were never kept, so "no usable file" is a normal outcome here,
 * not an error page. We say plainly what is missing instead of 404-ing.
 */
export default async function AdminOrderProofPage(props: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const service = supabaseService();
  const { data: orderRow } = await service.from("orders").select("*").eq("id", id).maybeSingle();
  const order = orderRow as Order | null;
  if (!order) notFound();

  const { data: proofRows } = await service
    .from("payment_proofs")
    .select("*")
    .eq("order_id", id)
    .order("created_at", { ascending: false });
  const proofs = (proofRows ?? []) as PaymentProof[];

  // A row can exist while the object behind it does not (deleted from the
  // bucket, or imported from a bank statement). Resolve each one for real.
  const resolved = await Promise.all(
    proofs.map(async (p) => {
      if (!p.storage_path) return { proof: p, url: null as string | null };
      const { data, error } = await service.storage
        .from(PROOF_BUCKET)
        .createSignedUrl(p.storage_path, 600);
      if (error || !data?.signedUrl) return { proof: p, url: null };
      return { proof: p, url: data.signedUrl };
    }),
  );

  const viewable = resolved.filter((r) => r.url);
  const broken = resolved.filter((r) => !r.url);

  return (
    <div className="rise-in">
      <PageHeader
        title={`Payment proof · ${order.order_ref}`}
        description={`${order.customer_name} · ${fmtDateTime(order.created_at)}`}
        actions={
          <Link
            href={`/admin/orders/${order.id}`}
            className="rounded-lg border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            ← Back to order
          </Link>
        }
      />

      {viewable.length === 0 && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-900"
        >
          <div className="flex items-start gap-3">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 size-6 shrink-0"
              aria-hidden
            >
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            <div>
              <p className="text-base font-semibold">This payment proof can&rsquo;t be opened.</p>
              <p className="mt-1 text-sm">
                {proofs.length === 0
                  ? "No screenshot was ever attached to this order — it was reconciled directly against the bank statement."
                  : "The stored file is missing or corrupted: the record exists, but the image behind it could not be read. It was most likely deleted from storage."}
              </p>
              <p className="mt-3 text-sm">
                The transfer itself is still evidenced by the order&rsquo;s status history and the
                bank statement it was matched against. You can attach a replacement screenshot from
                the order page if the customer still has it.
              </p>
              <Link
                href={`/admin/orders/${order.id}#proofs`}
                className="mt-4 inline-flex h-9 items-center rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-600"
              >
                Attach a proof manually
              </Link>
            </div>
          </div>
        </div>
      )}

      {viewable.length > 0 && (
        <div className="space-y-4">
          {viewable.map(({ proof, url }) => (
            <Card
              key={proof.id}
              title={`Uploaded ${fmtDateTime(proof.created_at)}`}
              actions={<Badge tone={TONES[proof.status]}>{proof.status}</Badge>}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url!}
                alt={`Payment proof for order ${order.order_ref}`}
                className="max-h-[70vh] w-auto rounded-lg border border-gray-200"
              />
              <p className="mt-3 text-xs text-gray-400">
                {proof.original_filename ?? "screenshot"} · {fmtBytes(proof.size_bytes)} ·{" "}
                {proof.mime}
                {proof.reviewed_at ? ` · reviewed ${fmtDateTime(proof.reviewed_at)}` : ""}
              </p>
              {proof.review_reason && (
                <p className="mt-1 text-xs text-gray-600">
                  <span className="font-medium">Review note:</span> {proof.review_reason}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {viewable.length > 0 && broken.length > 0 && (
        <p className="mt-4 text-xs text-amber-700">
          {broken.length} other proof record{broken.length === 1 ? "" : "s"} on this order point to
          files that are missing or corrupted.
        </p>
      )}
    </div>
  );
}
