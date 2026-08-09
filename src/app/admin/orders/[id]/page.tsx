import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { getOrderEmailEvents } from "@/lib/invoice-service";
import {
  ORDER_STATUS_LABELS,
  ORDER_TRANSITIONS,
  type EmailEvent,
  type Invoice,
  type Order,
  type OrderItem,
  type OrderStatusHistoryEntry,
  type PaymentProof,
} from "@/lib/db-types";
import { Badge, OrderStatusBadge } from "@/components/ui/badge";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { ActionForm } from "@/components/admin/action-form";
import { ProofRejectButton } from "@/components/admin/proof-reject-button";
import { ProofThumb } from "@/components/admin/proof-thumb";
import { AdminProofUpload } from "@/components/admin/admin-proof-upload";
import { egp, fmtBytes, fmtDateTime } from "@/components/admin/format";
import { Card, PageHeader, TableShell, Td, Th } from "@/components/admin/ui";
import {
  addCustomLineItemAction,
  deleteOrderAction,
  deleteProofAction,
  regenerateInvoiceAction,
  removeCustomLineItemAction,
  resendOrderEmailAction,
  reviewProofAction,
  setOrderStatusAction,
  setProofStatusAction,
  transitionOrderStatusAction,
} from "@/server/actions/admin/orders";

export const metadata = { title: "Order detail" };

const PROOF_TONES = { pending: "amber", approved: "green", rejected: "red" } as const;
const ALL_STATUSES = Object.keys(ORDER_STATUS_LABELS) as Array<keyof typeof ORDER_STATUS_LABELS>;

export default async function AdminOrderDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const service = supabaseService();
  const { data: orderRow } = await service.from("orders").select("*").eq("id", id).maybeSingle();
  const order = orderRow as Order | null;
  if (!order) notFound();

  const [itemsRes, proofsRes, invoicesRes, historyRes, emailEvents] = await Promise.all([
    service.from("order_items").select("*").eq("order_id", id).order("created_at", { ascending: true }),
    service.from("payment_proofs").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    service.from("invoices").select("*").eq("order_id", id),
    service
      .from("order_status_history")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    getOrderEmailEvents(id),
  ]);

  const items = (itemsRes.data ?? []) as OrderItem[];
  const proofs = (proofsRes.data ?? []) as PaymentProof[];
  const invoices = (invoicesRes.data ?? []) as Invoice[];
  const history = (historyRes.data ?? []) as OrderStatusHistoryEntry[];

  const nextStatuses = ORDER_TRANSITIONS[order.status];
  const finalAllowed = order.status === "paid" || order.status === "fulfilled";
  const invoiceByKind = new Map(invoices.map((i) => [i.kind, i]));

  return (
    <div className="rise-in">
      <PageHeader
        title={`Order ${order.order_ref}`}
        description={`Placed ${fmtDateTime(order.created_at)} · ${order.payment_method_label || "Manual payment"}`}
        actions={
          <>
            <OrderStatusBadge status={order.status} />
            <Link
              href={`/order/${order.tracking_token}`}
              target="_blank"
              rel="noopener"
              className="rounded-lg border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              Customer tracking page ↗
            </Link>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        {/* ------------------------------------------------ main column */}
        <div className="space-y-4 xl:col-span-2">
          <Card title="Items">
            <TableShell className="rounded-lg border-gray-100">
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th>SKU</Th>
                  <Th className="text-right">Unit price</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Amount</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className={it.is_custom ? "bg-brand-50/40" : undefined}>
                    <Td className="max-w-md">
                      <span className="line-clamp-2">{it.name_snapshot}</span>
                      {it.is_custom && (
                        <Badge tone="brand" className="mt-1">
                          Custom line
                        </Badge>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-gray-400">
                      {it.sku_snapshot ?? "—"}
                    </Td>
                    <Td className="whitespace-nowrap text-right">{egp(it.unit_price)}</Td>
                    <Td className="text-right">{it.qty}</Td>
                    <Td className="whitespace-nowrap text-right font-medium">{egp(it.amount)}</Td>
                    <Td className="text-right">
                      {it.is_custom && (
                        <ActionForm
                          action={removeCustomLineItemAction}
                          submitLabel="Remove"
                          submitVariant="ghost"
                          confirmMessage={`Remove "${it.name_snapshot}" and recompute the totals?`}
                          hideMessage
                        >
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="itemId" value={it.id} />
                        </ActionForm>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>

            <dl className="mt-3 ml-auto w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Subtotal</dt>
                <dd className="font-medium">{egp(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Adjustments</dt>
                <dd className="font-medium">{egp(order.adjustment_total)}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1 text-base">
                <dt className="font-semibold text-gray-900">Total</dt>
                <dd className="font-semibold text-brand-700">{egp(order.total)}</dd>
              </div>
            </dl>

            <details className="mt-4 rounded-lg border border-gray-200 p-3">
              <summary className="cursor-pointer text-sm font-medium text-brand-700">
                Add custom line item
              </summary>
              <ActionForm
                action={addCustomLineItemAction}
                submitLabel="Add item"
                resetOnSuccess
                className="mt-3 grid gap-3 sm:grid-cols-[1fr_10rem_6rem_auto] sm:items-end"
              >
                <input type="hidden" name="orderId" value={order.id} />
                <TextField
                  label="Description"
                  name="name"
                  required
                  minLength={2}
                  maxLength={200}
                  placeholder="Accessories / Service Balance"
                />
                <TextField
                  label="Unit price (EGP)"
                  name="unitPrice"
                  required
                  inputMode="decimal"
                  pattern="^\d+(\.\d{1,2})?$"
                  placeholder="150.00"
                />
                <TextField
                  label="Qty"
                  name="qty"
                  type="number"
                  min={1}
                  max={100000}
                  defaultValue={1}
                  required
                />
              </ActionForm>
              <p className="mt-2 text-xs text-gray-400">
                Custom lines land in the order adjustment and the totals are recomputed server-side.
              </p>
            </details>
          </Card>

          {/* ------------------------------------------------ proofs */}
          <Card
            title={`Payment proofs (${proofs.length})`}
            actions={
              <Link
                href={`/admin/orders/${order.id}/proof`}
                className="rounded-md border border-brand-200 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
              >
                Open proof page
              </Link>
            }
          >
            <span id="proofs" className="sr-only" />
            {proofs.length === 0 ? (
              <p className="text-sm text-gray-400">
                No payment proof on file — this order was reconciled against the bank statement.
                Attach one below if the customer sends it.
              </p>
            ) : (
              <ul className="space-y-4">
                {proofs.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 sm:flex-row"
                  >
                    <ProofThumb
                      src={`/api/admin/proofs/${p.id}/file`}
                      href={`/admin/orders/${order.id}/proof`}
                      alt={`Payment proof uploaded ${fmtDateTime(p.created_at)}`}
                    />
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={PROOF_TONES[p.status]}>{p.status}</Badge>
                        <span className="text-xs text-gray-400">
                          Uploaded {fmtDateTime(p.created_at)} · {fmtBytes(p.size_bytes)} · {p.mime}
                        </span>
                      </div>
                      {p.original_filename && (
                        <p className="mt-1 truncate text-xs text-gray-400">{p.original_filename}</p>
                      )}
                      {p.review_reason && (
                        <p className="mt-1 text-xs text-gray-600">
                          <span className="font-medium">Review note:</span> {p.review_reason}
                        </p>
                      )}
                      {p.reviewed_at && (
                        <p className="mt-1 text-xs text-gray-400">
                          Reviewed {fmtDateTime(p.reviewed_at)}
                        </p>
                      )}
                      {p.status === "pending" && (
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
                      )}

                      {/* Corrections after the fact — these touch the proof only,
                          never the order status. */}
                      <details className="mt-3 text-xs">
                        <summary className="cursor-pointer font-medium text-brand-700">
                          Correct this record
                        </summary>
                        <div className="mt-2 flex flex-wrap items-end gap-2">
                          <ActionForm
                            action={setProofStatusAction}
                            submitLabel="Set state"
                            submitVariant="outline"
                            hideMessage
                            className="flex items-end gap-2"
                          >
                            <input type="hidden" name="proofId" value={p.id} />
                            <SelectField label="State" name="status" defaultValue={p.status}>
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                            </SelectField>
                            <TextField label="Note" name="reason" maxLength={500} />
                          </ActionForm>
                          <ActionForm
                            action={deleteProofAction}
                            submitLabel="Delete proof"
                            submitVariant="ghost"
                            confirmMessage="Delete this payment proof and its stored file? This cannot be undone."
                            hideMessage
                          >
                            <input type="hidden" name="proofId" value={p.id} />
                          </ActionForm>
                        </div>
                      </details>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <details className="mt-4 rounded-lg border border-gray-200 p-3">
              <summary className="cursor-pointer text-sm font-medium text-brand-700">
                Attach a proof myself
              </summary>
              <div className="mt-3">
                <AdminProofUpload orderId={order.id} />
              </div>
            </details>
          </Card>

          {/* ------------------------------------------------ email log */}
          <Card title="Email log">
            {emailEvents.length === 0 ? (
              <p className="text-sm text-gray-400">No emails recorded for this order.</p>
            ) : (
              <TableShell className="rounded-lg border-gray-100">
                <thead>
                  <tr>
                    <Th>Kind</Th>
                    <Th>Recipient</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Attempts</Th>
                    <Th>Error</Th>
                    <Th>Updated</Th>
                  </tr>
                </thead>
                <tbody>
                  {emailEvents.map((e) => {
                    const updated =
                      (e as EmailEvent & { updated_at?: string }).updated_at ?? e.created_at;
                    return (
                      <tr key={e.id}>
                        <Td className="whitespace-nowrap font-medium">{e.kind}</Td>
                        <Td className="max-w-48 truncate">{e.recipient}</Td>
                        <Td>
                          <Badge tone={e.status === "sent" ? "green" : e.status === "failed" ? "red" : "gray"}>
                            {e.status}
                          </Badge>
                        </Td>
                        <Td className="text-right">{e.attempts}</Td>
                        <Td className="max-w-56">
                          {e.error ? (
                            <span className="block truncate text-xs text-red-600" title={e.error}>
                              {e.error}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </Td>
                        <Td className="whitespace-nowrap text-xs text-gray-400">
                          {fmtDateTime(updated)}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>
            )}
            <p className="mt-3 text-xs text-gray-400">
              Sends are deduplicated per order and kind — “Resend email” safely forces a fresh copy
              without double-sending on retries.
            </p>
          </Card>
        </div>

        {/* ------------------------------------------------ side column */}
        <div className="space-y-4">
          <Card title="Customer">
            <dl className="space-y-1.5 text-sm">
              <div>
                <dt className="text-xs text-gray-400">Name</dt>
                <dd className="font-medium text-gray-900">{order.customer_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Email</dt>
                <dd>
                  <a href={`mailto:${order.email}`} className="break-all text-brand-700 hover:underline">
                    {order.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Shipping &amp; delivery</dt>
                <dd className="text-gray-500">
                  Collected on the external order platform after payment.
                </dd>
              </div>
              {order.customer_note && (
                <div>
                  <dt className="text-xs text-gray-400">Customer note</dt>
                  <dd className="whitespace-pre-wrap text-gray-600">{order.customer_note}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card title="Status">
            {nextStatuses.length === 0 ? (
              <p className="text-sm text-gray-400">
                {ORDER_STATUS_LABELS[order.status]} is a final state — no further transitions.
              </p>
            ) : (
              <ActionForm
                action={transitionOrderStatusAction}
                submitLabel="Apply transition"
                confirmMessage="Apply this status change?"
                className="space-y-3"
              >
                <input type="hidden" name="orderId" value={order.id} />
                <SelectField label="New status" name="toStatus" required>
                  {nextStatuses.map((s) => (
                    <option key={s} value={s}>
                      {ORDER_STATUS_LABELS[s]}
                    </option>
                  ))}
                </SelectField>
                <TextAreaField
                  label="Reason (optional)"
                  name="reason"
                  maxLength={500}
                  className="min-h-16"
                  hint="Stored in the order history."
                />
              </ActionForm>
            )}
            {/* Owner override: the normal transition rules are a safety net for
                the day-to-day flow, not a cage — a wrong record must be
                fixable. No email is sent from here. */}
            <details className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <summary className="cursor-pointer text-sm font-medium text-amber-800">
                Set any status (manual correction)
              </summary>
              <ActionForm
                action={setOrderStatusAction}
                submitLabel="Force status"
                submitVariant="outline"
                confirmMessage="Set this order to the chosen status, ignoring the normal flow? No email is sent."
                className="mt-3 space-y-3"
              >
                <input type="hidden" name="orderId" value={order.id} />
                <SelectField label="Status" name="toStatus" required defaultValue={order.status}>
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {ORDER_STATUS_LABELS[s]}
                    </option>
                  ))}
                </SelectField>
                <TextAreaField
                  label="Why (optional)"
                  name="reason"
                  maxLength={500}
                  className="min-h-16"
                  hint="Recorded in the order history and the audit log."
                />
              </ActionForm>
            </details>

            {history.length > 0 && (
              <ol className="mt-4 space-y-2 border-t border-gray-100 pt-3 text-xs text-gray-500">
                {history.map((h) => (
                  <li key={h.id}>
                    <span className="font-medium text-gray-700">
                      {h.from_status ? `${ORDER_STATUS_LABELS[h.from_status]} → ` : ""}
                      {ORDER_STATUS_LABELS[h.to_status]}
                    </span>{" "}
                    · {h.actor} · {fmtDateTime(h.created_at)}
                    {h.reason && <span className="block text-gray-400">“{h.reason}”</span>}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card title="Invoices">
            <ul className="space-y-4">
              {(["preliminary", "final"] as const).map((kind) => {
                const invoice = invoiceByKind.get(kind);
                const enabled = kind === "preliminary" || finalAllowed;
                return (
                  <li key={kind} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold capitalize text-gray-900">{kind}</p>
                      <p className="text-xs text-gray-400">
                        {invoice ? `Generated ${fmtDateTime(invoice.generated_at)}` : "Not generated yet"}
                      </p>
                    </div>
                    {!enabled ? (
                      <p className="mt-2 text-xs text-gray-400">
                        Available once the order is Paid or Fulfilled.
                      </p>
                    ) : (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {invoice && (
                          <a
                            href={`/api/admin/orders/${order.id}/invoice?kind=${kind}`}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex h-8 items-center rounded-md border border-brand-200 px-3 text-sm font-medium text-brand-800 hover:bg-brand-50"
                          >
                            Preview
                          </a>
                        )}
                        <ActionForm
                          action={regenerateInvoiceAction}
                          submitLabel={invoice ? "Regenerate" : "Generate"}
                          submitVariant="outline"
                          hideMessage={false}
                        >
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="kind" value={kind} />
                        </ActionForm>
                        <ActionForm
                          action={resendOrderEmailAction}
                          submitLabel="Resend email"
                          submitVariant="secondary"
                          confirmMessage={`Force-resend the ${kind} email (with PDF) to ${order.email}?`}
                        >
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="kind" value={kind} />
                        </ActionForm>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-gray-400">
              Regenerating rebuilds the PDF from the current order snapshot (custom lines included).
            </p>
          </Card>

          <Card title="Delete this order" className="border-red-200">
            <p className="text-sm text-gray-600">
              Removes the order together with its items, status history, payment proofs and
              receipts — including the stored files. This cannot be undone.
            </p>
            <ActionForm
              action={deleteOrderAction}
              submitLabel="Delete order permanently"
              submitVariant="danger"
              confirmMessage={`Delete ${order.order_ref} for good?`}
              className="mt-3 space-y-3"
            >
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="returnTo" value="/admin/orders" />
              <TextField
                label={`Type ${order.order_ref} to confirm`}
                name="confirmRef"
                required
                maxLength={40}
                autoComplete="off"
                placeholder={order.order_ref}
              />
            </ActionForm>
          </Card>
        </div>
      </div>
    </div>
  );
}
