"use client";

/**
 * Checkout form: contact + delivery details, payment method choice, live
 * order summary. Submits product ids + quantities only — the server
 * re-fetches and re-prices everything. The idempotency key is generated ONCE
 * per mount so double submissions cannot create duplicate orders.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import { fetchCartProducts, previewUnitPiasters, type CartProduct } from "@/lib/cart-products";
import { formatEgp, lineAmount, sumPiasters } from "@/lib/money";
import { GOVERNORATES } from "@/lib/egypt";
import { placeOrder } from "@/server/actions/checkout";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { PageLoading, Spinner } from "@/components/ui/spinner";
import { TurnstileWidget, type TurnstileHandle } from "@/components/turnstile-widget";

export interface CheckoutPrefill {
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  taxId: string;
  governorate: string;
  address: string;
}

export interface CheckoutPaymentMethod {
  id: string;
  kind: string;
  label: string;
  number: string;
  display_name: string | null;
}

export function CheckoutForm({
  prefill,
  paymentMethods,
  minOrderPiasters,
  vatNote,
}: {
  prefill: CheckoutPrefill;
  paymentMethods: CheckoutPaymentMethod[];
  minOrderPiasters: number;
  vatNote: string;
}) {
  const router = useRouter();
  const { lines, ready, clear } = useCart();
  const [products, setProducts] = useState<Map<string, CartProduct> | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id ?? "");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileHandle>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ONE idempotency key per checkout mount: a network retry or double-click
  // resolves to the same order on the server.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const idsKey = useMemo(() => lines.map((l) => l.productId).sort().join(","), [lines]);

  // Retry support: bumping the counter re-runs the fetch effect.
  const [loadAttempt, setLoadAttempt] = useState(0);
  const load = useCallback(() => setLoadAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!ready) return;
    let stale = false;
    const ids = idsKey ? idsKey.split(",") : [];
    fetchCartProducts(ids)
      .then((map) => {
        if (stale) return;
        setProducts(map);
        setLoadError(false);
      })
      .catch(() => {
        if (!stale) setLoadError(true);
      });
    return () => {
      stale = true;
    };
  }, [ready, idsKey, loadAttempt]);

  if (!ready || (products === null && !loadError)) {
    return <PageLoading label="Preparing checkout…" />;
  }

  if (loadError) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-gray-600">Checkout could not load your cart.</p>
        <Button variant="outline" className="mt-4" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <h2 className="text-lg font-semibold text-gray-900">Your cart is empty</h2>
        <p className="mt-1 text-sm text-gray-500">Add products before checking out.</p>
        <Link
          href="/catalog"
          className="mt-5 inline-flex items-center rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
        >
          Browse the catalog
        </Link>
      </div>
    );
  }

  const productMap = products ?? new Map<string, CartProduct>();
  const missing = lines.filter((l) => !productMap.has(l.productId));
  const summary = lines
    .filter((l) => productMap.has(l.productId))
    .map((l) => {
      const p = productMap.get(l.productId)!;
      const qty = Math.max(l.qty, p.moq); // display + submit clamped to MOQ
      const unit = previewUnitPiasters(p, qty);
      return { product: p, qty, unit, total: lineAmount(unit, qty) };
    });
  const subtotal = sumPiasters(summary.map((s) => s.total));
  const belowMin = subtotal < minOrderPiasters;
  const hasOutOfStock = summary.some((s) => s.product.stock_status === "out_of_stock");
  const blocked = missing.length > 0 || hasOutOfStock || belowMin;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked || submitting) return;
    setSubmitError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      items: summary.map((s) => ({ productId: s.product.id, qty: s.qty })),
      paymentMethodId,
      idempotencyKey,
      customerName: String(form.get("customerName") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      companyName: String(form.get("companyName") ?? ""),
      taxId: String(form.get("taxId") ?? ""),
      governorate: String(form.get("governorate") ?? ""),
      address: String(form.get("address") ?? ""),
      customerNote: String(form.get("customerNote") ?? ""),
      turnstileToken,
    };

    setSubmitting(true);
    try {
      const result = await placeOrder(payload);
      if ("trackingToken" in result) {
        clear();
        router.push(`/order/${result.trackingToken}`);
        return; // keep `submitting` while navigating
      }
      setSubmitError(result.error);
      setTurnstileToken("");
      turnstileRef.current?.reset();
      setSubmitting(false);
    } catch {
      setSubmitError("Something went wrong placing your order. Please try again.");
      setTurnstileToken("");
      turnstileRef.current?.reset();
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-5" noValidate>
      <div className="space-y-6 lg:col-span-3">
        {(missing.length > 0 || hasOutOfStock) && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <p className="font-medium">Your cart needs attention.</p>
            <p className="mt-1">
              Some items are unavailable or out of stock.{" "}
              <Link href="/cart" className="font-medium underline">
                Review your cart
              </Link>{" "}
              before placing the order.
            </p>
          </div>
        )}

        {/* Contact & delivery */}
        <section
          aria-labelledby="contact-heading"
          className="rise-in rounded-xl border border-gray-200 bg-white p-5 sm:p-6"
        >
          <h2 id="contact-heading" className="text-base font-semibold text-gray-900">
            Contact & delivery
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField
              label="Full name"
              name="customerName"
              autoComplete="name"
              required
              defaultValue={prefill.fullName}
            />
            <TextField
              label="Mobile number"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="01012345678"
              required
              defaultValue={prefill.phone}
            />
            <TextField
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={prefill.email}
              hint="Your receipts are sent here."
            />
            <TextField
              label="Company name"
              name="companyName"
              autoComplete="organization"
              defaultValue={prefill.companyName}
            />
            <TextField label="Tax ID" name="taxId" defaultValue={prefill.taxId} hint="Optional." />
            <SelectField
              label="Governorate"
              name="governorate"
              required
              defaultValue={prefill.governorate}
            >
              <option value="" disabled>
                Select…
              </option>
              {GOVERNORATES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </SelectField>
            <div className="sm:col-span-2">
              <TextAreaField
                label="Delivery address"
                name="address"
                autoComplete="street-address"
                required
                defaultValue={prefill.address}
                hint="Street, building, floor — anything the courier needs."
              />
            </div>
            <div className="sm:col-span-2">
              <TextAreaField
                label="Order note"
                name="customerNote"
                hint="Optional — anything we should know about this order."
              />
            </div>
          </div>
        </section>

        {/* Payment method */}
        <section
          aria-labelledby="payment-heading"
          className="rise-in rounded-xl border border-gray-200 bg-white p-5 sm:p-6"
        >
          <h2 id="payment-heading" className="text-base font-semibold text-gray-900">
            Payment method
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            You&rsquo;ll pay by bank-app transfer after placing the order — nothing is charged
            here.
          </p>

          {paymentMethods.length === 0 ? (
            <p className="mt-4 text-sm text-red-600" role="alert">
              No payment methods are available right now. Please contact us to order.
            </p>
          ) : (
            <fieldset className="mt-4">
              <legend className="sr-only">Choose a payment method</legend>
              <div className="space-y-2">
                {paymentMethods.map((m) => (
                  <label
                    key={m.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      paymentMethodId === m.id
                        ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-200"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={m.id}
                      checked={paymentMethodId === m.id}
                      onChange={() => setPaymentMethodId(m.id)}
                      className="mt-1 size-4 accent-brand-700"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900">{m.label}</span>
                      <span className="block font-mono text-sm text-gray-600">{m.number}</span>
                      {m.display_name && (
                        <span className="block text-xs text-gray-500">
                          Account name: {m.display_name}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </section>
      </div>

      {/* Summary */}
      <aside aria-label="Order summary" className="lg:col-span-2">
        <div className="sticky top-20 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-base font-semibold text-gray-900">Order summary</h2>

            <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1 text-sm">
              {summary.map((s) => (
                <li key={s.product.id} className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-gray-700">{s.product.name}</span>
                    <span className="text-xs text-gray-400">
                      {s.qty} × {formatEgp(s.unit)}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium text-gray-900">{formatEgp(s.total)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-sm">
              <span className="font-medium text-gray-700">Subtotal</span>
              <span className="text-base font-semibold text-gray-900">{formatEgp(subtotal)}</span>
            </div>
            {belowMin && (
              <p role="alert" className="mt-2 text-xs font-medium text-amber-700">
                The minimum order is {formatEgp(minOrderPiasters)} — add{" "}
                {formatEgp(minOrderPiasters - subtotal)} more in your cart.
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500">{vatNote}</p>
            <p className="mt-1 text-xs text-gray-400">
              Final prices are recalculated on our server when you place the order.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <TurnstileWidget ref={turnstileRef} onToken={(t) => setTurnstileToken(t ?? "")} />

            {submitError && (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200"
              >
                {submitError}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="mt-4 w-full"
              disabled={blocked || submitting || !turnstileToken || paymentMethods.length === 0}
            >
              {submitting && <Spinner className="size-4 border-white/40 border-t-white" />}
              {submitting ? "Placing order…" : "Place order"}
            </Button>
            {!turnstileToken && !submitting && (
              <p className="mt-2 text-center text-xs text-gray-400">
                Waiting for human verification…
              </p>
            )}
            <p className="mt-3 text-center text-xs text-gray-500">
              After placing the order you&rsquo;ll get transfer instructions and upload your
              payment screenshot.
            </p>
          </div>
        </div>
      </aside>
    </form>
  );
}
