import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseService } from "@/lib/supabase/server";
import { getSiteSettings, telegramUrl } from "@/lib/settings";
import { qrSvg } from "@/lib/qr";
import { formatEgp, toPiasters } from "@/lib/money";
import { TRACKING_TOKEN_PATTERN } from "@/lib/validation";
import type {
  Invoice,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PaymentProof,
} from "@/lib/db-types";
import { Badge, OrderStatusBadge } from "@/components/ui/badge";
import { CopyButton } from "@/components/order/copy-button";
import { ProofUpload } from "@/components/order/proof-upload";
import { ContactBeforePaying } from "@/components/site/contact-before-paying";

export const metadata: Metadata = {
  title: "Order tracking",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ token: string }>;
}

/**
 * Public order-tracking page. The 48-hex tracking token IS the credential:
 * possession of the link (from the confirmation email / account page) grants
 * read access to this one order — including for the logged-in owner arriving
 * from /account.
 */
export default async function OrderTrackingPage(props: Props) {
  const { token } = await props.params;
  if (!TRACKING_TOKEN_PATTERN.test(token)) notFound();

  // Authorization = the capability token itself (checked above + by lookup).
  const service = supabaseService();
  const { data: orderRow } = await service
    .from("orders")
    .select("*")
    .eq("tracking_token", token)
    .maybeSingle();
  if (!orderRow) notFound();
  const order = orderRow as Order;

  const settings = await getSiteSettings();
  const telegram = telegramUrl(settings.contact.telegram);

  const [{ data: itemRows }, { data: proofRows }, { data: invoiceRows }, { data: methodRows }] =
    await Promise.all([
      service
        .from("order_items")
        .select("*")
        .eq("order_id", order.id)
        .order("created_at", { ascending: true }),
      service
        .from("payment_proofs")
        .select("*")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false })
        .limit(1),
      service.from("invoices").select("*").eq("order_id", order.id).order("kind"),
      service
        .from("payment_methods")
        .select("*")
        .eq("active", true)
        .order("sort")
        .order("label"),
    ]);

  const items = (itemRows ?? []) as OrderItem[];
  const latestProof = ((proofRows ?? [])[0] ?? null) as PaymentProof | null;
  const invoices = (invoiceRows ?? []) as Invoice[];
  const methods = (methodRows ?? []) as PaymentMethod[];

  const totalPiasters = toPiasters(String(order.total));
  const subtotalPiasters = toPiasters(String(order.subtotal));
  const adjustmentPiasters = toPiasters(String(order.adjustment_total));

  const showPayment =
    order.status === "awaiting_payment" ||
    (order.status === "awaiting_verification" && latestProof?.status === "rejected");
  const showProofUpload =
    order.status === "awaiting_payment" || order.status === "awaiting_verification";

  // Only payment methods the order actually qualifies for (e.g. bank transfer
  // is offered only for large orders — same rule as checkout).
  const payableMethods = methods.filter(
    (m) => totalPiasters >= toPiasters(String(m.min_order_egp ?? 0)),
  );

  // After payment, the customer confirms the order + enters shipping details on
  // an external platform. We send that link separately (each order can use a
  // different platform), so this page only sets the expectation.
  const awaitingPaymentStage =
    order.status === "awaiting_payment" || order.status === "awaiting_verification";

  // Receipts actually downloadable right now (the API re-checks all of this).
  const visibleInvoices = invoices.filter((inv) =>
    inv.kind === "final"
      ? order.status === "paid" || order.status === "fulfilled"
      : Boolean(latestProof) ||
        ["awaiting_verification", "paid", "fulfilled"].includes(order.status),
  );

  // Admin-uploaded QR images take precedence; otherwise generate one from the
  // wallet/Instapay number.
  const methodQrs = showPayment
    ? await Promise.all(
        payableMethods.map((m) =>
          m.qr_path || m.kind === "bank" ? Promise.resolve("") : qrSvg(m.number),
        ),
      )
    : [];
  const qrImageUrl = (path: string) =>
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site-assets/${path}`;

  const placedOn = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(order.created_at));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900">Order {order.order_ref}</h1>
            <CopyButton value={order.order_ref} label="Copy order reference" />
          </div>
          <p className="mt-1 text-sm text-gray-500">Placed {placedOn}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Status timeline */}
      <div className="rise-in mt-6 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
        {order.status === "cancelled" ? (
          <div role="status" className="flex items-center gap-3 text-sm text-red-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-6 shrink-0" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
            <div>
              <p className="font-semibold">This order was cancelled.</p>
              <p className="mt-0.5 text-red-600">
                If you believe this is a mistake, contact us and mention reference{" "}
                <span className="font-mono">{order.order_ref}</span>.
              </p>
            </div>
          </div>
        ) : (
          <StatusTimeline status={order.status} />
        )}
      </div>

      {/* What happens next — the flow explained on the confirmation page */}
      {awaitingPaymentStage && (
        <section
          aria-labelledby="next-heading"
          className="rise-in mt-6 rounded-xl border border-brand-200 bg-brand-50/40 p-5 sm:p-6"
        >
          <h2 id="next-heading" className="text-base font-semibold text-gray-900">
            What happens next
          </h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-gray-700">
            <li>
              {showPayment
                ? "Transfer the total below and upload your payment screenshot."
                : "We've received your payment screenshot — thank you."}
            </li>
            <li>We verify your payment — this is manual and usually quick.</li>
            <li>
              Once your payment is validated, we send you a link to{" "}
              <strong>confirm your order and enter your shipping details</strong>.
            </li>
            <li>Courier service will contact you with next steps.</li>
          </ol>
        </section>
      )}

      {/* Post-payment: confirm the order + shipping on the external platform */}
      {order.status === "paid" && (
        <section
          aria-labelledby="confirm-heading"
          className="rise-in mt-6 rounded-xl border border-brand-300 bg-brand-50/40 p-5 sm:p-6"
        >
          <h2 id="confirm-heading" className="text-base font-semibold text-gray-900">
            Confirm your order &amp; shipping details
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Your payment is confirmed 🎉 — one last step. We&rsquo;ll send you a link to confirm
            your order and enter your shipping details so a courier can deliver. Keep your order
            reference <strong className="font-mono text-brand-800">{order.order_ref}</strong> handy.
          </p>
          <p className="mt-3 text-sm text-gray-500">
            If you haven&rsquo;t received it yet, contact us and mention your order reference.
          </p>
        </section>
      )}

      {/* Rejected proof */}
      {latestProof?.status === "rejected" && showProofUpload && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
        >
          <p className="font-semibold">Your payment proof was rejected.</p>
          <p className="mt-1">
            {latestProof.review_reason
              ? `Reason: ${latestProof.review_reason}`
              : "The screenshot could not be matched to a transfer."}{" "}
            Please check the transfer details below and upload a new screenshot.
          </p>
        </div>
      )}

      {/* Payment instructions */}
      {showPayment && (
        <section
          aria-labelledby="payment-heading"
          className="rise-in mt-6 rounded-xl border border-brand-200 bg-brand-50/40 p-5 sm:p-6"
        >
          <h2 id="payment-heading" className="text-base font-semibold text-gray-900">
            How to pay
          </h2>

          <ContactBeforePaying telegram={telegram} className="mt-3" />

          <p className="mt-4 text-sm text-gray-700">
            Transfer <strong className="text-brand-800">exactly {formatEgp(totalPiasters)}</strong>{" "}
            to one of the accounts below.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {payableMethods.map((m, i) => (
              <div
                key={m.id}
                className={`rounded-xl border bg-white p-4 ${
                  m.id === order.payment_method_id ? "border-brand-400 ring-1 ring-brand-200" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">{m.label}</p>
                  {m.id === order.payment_method_id && <Badge tone="brand">Your choice</Badge>}
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <p className="font-mono text-sm text-gray-700">{m.number}</p>
                  <CopyButton value={m.number} label={`Copy ${m.label} number`} />
                </div>
                {m.display_name && (
                  <p className="mt-1 text-xs text-gray-500">
                    The recipient name shown should be <strong>{m.display_name}</strong>.
                  </p>
                )}
                {m.instructions && <p className="mt-1 text-xs text-gray-500">{m.instructions}</p>}
                {m.qr_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrImageUrl(m.qr_path)}
                    alt={`QR code for ${m.label} ${m.number}`}
                    className="mt-3 w-28 rounded bg-white"
                    loading="lazy"
                  />
                ) : methodQrs[i] ? (
                  <div
                    className="mt-3 w-28 [&>svg]:h-auto [&>svg]:w-full"
                    aria-label={`QR code for ${m.label} ${m.number}`}
                    role="img"
                    // qrSvg output is our own generated SVG, not user content.
                    dangerouslySetInnerHTML={{ __html: methodQrs[i] }}
                  />
                ) : null}
              </div>
            ))}
            {payableMethods.length === 0 && (
              <p className="text-sm text-red-600">
                Payment methods are temporarily unavailable — please contact us.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Proof upload / status */}
      {showProofUpload && (
        <section
          aria-labelledby="proof-heading"
          className="rise-in mt-6 rounded-xl border border-gray-200 bg-white p-5 sm:p-6"
        >
          <h2 id="proof-heading" className="text-base font-semibold text-gray-900">
            Payment proof
          </h2>

          {latestProof?.status === "pending" ? (
            <div
              role="status"
              className="mt-3 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-800 ring-1 ring-inset ring-sky-200"
            >
              <p className="font-medium">Your screenshot is being reviewed.</p>
              <p className="mt-0.5">
                Verification is manual and usually quick. You&rsquo;ll receive the final receipt by
                email once the payment is confirmed. You can upload a newer screenshot below if
                needed.
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-gray-500">
              After transferring, upload a screenshot of the transfer so we can verify your
              payment.
            </p>
          )}

          <div className="mt-4">
            <ProofUpload
              orderId={order.id}
              token={token}
              receiptUrl={`/api/orders/${order.id}/receipt?kind=preliminary&token=${token}`}
            />
          </div>
        </section>
      )}

      {/* Receipts */}
      {visibleInvoices.length > 0 && (
        <section
          aria-labelledby="receipts-heading"
          className="rise-in mt-6 rounded-xl border border-gray-200 bg-white p-5 sm:p-6"
        >
          <h2 id="receipts-heading" className="text-base font-semibold text-gray-900">
            Receipts
          </h2>
          <ul className="mt-3 space-y-2">
            {visibleInvoices.map((inv) => (
              <li key={inv.id}>
                <a
                  href={`/api/orders/${order.id}/receipt?kind=${inv.kind}&token=${token}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 underline-offset-2 hover:underline"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden>
                    <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                    <path d="M5 21h14" />
                  </svg>
                  {inv.kind === "final" ? "Final receipt" : "Preliminary receipt"} (PDF)
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-gray-500">
            The preliminary receipt confirms your order details; the final receipt is issued after
            payment verification.
          </p>
        </section>
      )}

      {/* Items */}
      <section
        aria-labelledby="items-heading"
        className="rise-in mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white"
      >
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 id="items-heading" className="text-base font-semibold text-gray-900">
            Items
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                <th scope="col" className="px-5 py-3 font-medium">Item</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Qty</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Unit</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-3 text-gray-900">
                    {item.name_snapshot}
                    {item.is_custom && (
                      <Badge tone="blue" className="ml-2">
                        Added by HDML
                      </Badge>
                    )}
                    {item.sku_snapshot && (
                      <span className="block text-xs text-gray-400">{item.sku_snapshot}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700">{item.qty}</td>
                  <td className="px-3 py-3 text-right text-gray-700">
                    {formatEgp(toPiasters(String(item.unit_price)))}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">
                    {formatEgp(toPiasters(String(item.amount)))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-100 text-sm">
              <tr>
                <td colSpan={3} className="px-5 py-2.5 pt-4 text-right text-gray-500">
                  Subtotal
                </td>
                <td className="px-5 py-2.5 pt-4 text-right font-medium text-gray-900">
                  {formatEgp(subtotalPiasters)}
                </td>
              </tr>
              {adjustmentPiasters !== 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-2.5 text-right text-gray-500">
                    Adjustments
                  </td>
                  <td className="px-5 py-2.5 text-right font-medium text-gray-900">
                    {formatEgp(adjustmentPiasters)}
                  </td>
                </tr>
              )}
              <tr>
                <td colSpan={3} className="px-5 py-3 pb-4 text-right font-semibold text-gray-900">
                  Total
                </td>
                <td className="px-5 py-3 pb-4 text-right text-base font-bold text-brand-800">
                  {formatEgp(totalPiasters)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Customer & order details (shipping is handled on the external platform) */}
      <section
        aria-labelledby="details-heading"
        className="rise-in mt-6 rounded-xl border border-gray-200 bg-white p-5 sm:p-6"
      >
        <h2 id="details-heading" className="text-base font-semibold text-gray-900">
          Order details
        </h2>
        <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">Name</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{order.customer_name}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Email</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{order.email}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Payment method</dt>
            <dd className="mt-0.5 font-medium text-gray-900">
              {order.payment_method_label || "Manual transfer"}
            </dd>
          </div>
          {order.customer_note && (
            <div className="sm:col-span-2">
              <dt className="text-gray-500">Your note</dt>
              <dd className="mt-0.5 text-gray-700">{order.customer_note}</dd>
            </div>
          )}
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Shipping &amp; delivery</dt>
            <dd className="mt-0.5 text-gray-500">
              Collected after payment via the order-confirmation link we send you.
            </dd>
          </div>
        </dl>
      </section>

      <p className="mt-6 text-center text-xs text-gray-400">
        Keep this link private — anyone with it can view this order.{" "}
        <Link href="/account" className="text-brand-700 hover:underline">
          See all your orders
        </Link>
      </p>
    </div>
  );
}

// "Paid" is the final step HDML tracks — after that the customer completes the
// order + shipping on an external platform and a courier delivers.
const TIMELINE_STEPS: Array<{ status: OrderStatus; label: string; hint: string }> = [
  { status: "awaiting_payment", label: "Awaiting payment", hint: "Transfer & upload proof" },
  { status: "awaiting_verification", label: "Under review", hint: "We verify your transfer" },
  { status: "paid", label: "Paid", hint: "Confirm order & shipping" },
];

function StatusTimeline({ status }: { status: Exclude<OrderStatus, "cancelled"> }) {
  // Any legacy "fulfilled" order lands on the last (Paid) step.
  const idx = TIMELINE_STEPS.findIndex((s) => s.status === status);
  const current = idx === -1 ? TIMELINE_STEPS.length - 1 : idx;
  return (
    <ol className="grid grid-cols-3 gap-y-6" aria-label="Order progress">
      {TIMELINE_STEPS.map((step, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={step.status} className="relative flex flex-col items-center px-2 text-center">
            {/* connector */}
            {i > 0 && (
              <span
                aria-hidden
                className={`absolute left-[-50%] top-4 hidden h-0.5 w-full sm:block ${
                  i <= current ? "bg-brand-600" : "bg-gray-200"
                }`}
              />
            )}
            <span
              className={`relative z-10 flex size-8 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-white ${
                state === "done"
                  ? "bg-brand-600 text-white"
                  : state === "current"
                    ? "bg-brand-50 text-brand-800 outline outline-2 outline-brand-600"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {state === "done" ? (
                <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden>
                  <path
                    fillRule="evenodd"
                    d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.79 6.8-6.8a1 1 0 0 1 1.4 0Z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span
              className={`mt-2 text-xs font-medium ${
                state === "todo" ? "text-gray-400" : "text-gray-900"
              }`}
              aria-current={state === "current" ? "step" : undefined}
            >
              {step.label}
            </span>
            <span className="mt-0.5 hidden text-[11px] text-gray-400 sm:block">{step.hint}</span>
          </li>
        );
      })}
    </ol>
  );
}
