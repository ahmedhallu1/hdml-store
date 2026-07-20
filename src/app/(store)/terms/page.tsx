import type { Metadata } from "next";
import Link from "next/link";
import { waLink } from "@/lib/egypt";
import { formatEgp, toPiasters } from "@/lib/money";
import { getSiteSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "HDML wholesale terms: ordering, MOQ, pricing and VAT, manual payment and verification, delivery and cancellations.",
};

const h2 = "mt-8 text-xl font-semibold text-gray-900";
const p = "mt-2 leading-relaxed text-gray-700";

export default async function TermsPage() {
  const { seller_info, ordering, delivery, contact, branding } = await getSiteSettings();
  const minOrder = formatEgp(toPiasters(String(ordering.min_order_egp)));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Terms of service</h1>
      <p className="mt-3 leading-relaxed text-gray-600">
        These terms apply to every order placed on the {branding.store_name} store. Placing an
        order means you accept them.
      </p>

      <h2 className={h2}>1. Who you are buying from</h2>
      <p className={p}>
        The store is operated by {seller_info.name}, {seller_info.address}. We sell wholesale
        electronics and accessories to businesses and resellers across Egypt.
      </p>
      <p className={p}>
        {branding.store_name} is a registered business with the Egyptian Ministry of Finance — Tax
        Authority (Damanhour). Registration details:
      </p>
      <ul className="mt-2 space-y-1 text-gray-700">
        <li>
          <strong>Registered owner:</strong> {seller_info.name}
        </li>
        <li>
          <strong>Tax Registration No.:</strong> {seller_info.tax_id}
        </li>
        <li>
          <strong>Registered activity:</strong> Retail trade via order-fulfilment houses and the
          internet (activity code 4791)
        </li>
        <li>
          <strong>Registered address:</strong> {seller_info.address}
        </li>
      </ul>

      <h2 className={h2}>2. Wholesale ordering &amp; minimums</h2>
      <p className={p}>
        This is a wholesale store: products carry a per-product minimum order quantity (MOQ) shown
        on each product page, and the order total must be at least <strong>{minOrder}</strong>.
        Both minimums are enforced at checkout. Quantities and totals are always recalculated on
        our side from current catalog data.
      </p>

      <h2 className={h2}>3. Pricing &amp; VAT</h2>
      <p className={p}>
        All prices are in {ordering.currency}. {ordering.vat_note} Prices do{" "}
        <strong>not</strong> include customs clearance or import duties, which are the buyer&rsquo;s
        responsibility and are non-refundable. Wholesale tier prices apply automatically based on
        quantity where a product defines them. Catalog prices can change at any time, but the prices
        captured when your order is placed are the ones that count for that order.
      </p>

      <h2 className={h2}>4. Payment — manual transfer, manual verification</h2>
      <p className={p}>
        We accept payment by <strong>Instapay and mobile-wallet transfer only</strong> — there is
        no online card payment. After placing an order you transfer the total to the payment number
        shown, then upload a screenshot of the transfer. Uploading a proof does{" "}
        <strong>not</strong> mean the order is paid: every proof is verified manually by our team,
        and the order is confirmed as paid only after that verification. If a proof cannot be
        verified we contact you to resolve it. Receipts are emailed as PDFs once payment is
        confirmed.
      </p>

      <h2 className={h2}>5. Availability</h2>
      <p className={p}>
        Items marked &quot;Availability confirmed after ordering&quot; are checked with our
        suppliers after you order. If an item turns out to be unavailable we contact you to adjust
        or refund that line before proceeding.
      </p>

      <h2 className={h2}>6. Delivery</h2>
      <p className={p}>
        Delivery is handled by a courier service across {delivery.regions}, typically within{" "}
        {delivery.time} after your payment is confirmed and your order is completed. {delivery.fee_note}{" "}
        Full details are on the{" "}
        <Link href="/delivery" className="font-medium text-brand-700 hover:text-brand-600">
          delivery page
        </Link>
        .
      </p>

      <h2 className={h2}>7. Cancellations &amp; returns</h2>
      <p className={p}>
        You can cancel an order any time before it is marked paid — after that, contact us with your
        order ID and we will do our best to help. Report damaged, defective or wrong items within{" "}
        <strong>48 hours of receiving your order</strong> through any of our contact channels;
        customs clearance and import duties are non-refundable. Full details are in the{" "}
        <Link href="/returns" className="font-medium text-brand-700 hover:text-brand-600">
          returns policy
        </Link>
        .
      </p>

      <h2 className={h2}>8. Fair use</h2>
      <p className={p}>
        We may cancel and refund orders that appear fraudulent, abusive, or based on an obvious
        pricing error, and we will tell you when that happens. Your order tracking link is private
        — anyone holding it can view the order, so share it carefully.
      </p>

      <h2 className={h2}>9. Contact</h2>
      <p className={p}>
        Questions about these terms? Message us on WhatsApp at{" "}
        <a
          href={waLink(contact.whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-700 hover:text-brand-600"
        >
          {contact.whatsapp}
        </a>{" "}
        or email{" "}
        <a href={`mailto:${contact.email}`} className="font-medium text-brand-700 hover:text-brand-600">
          {contact.email}
        </a>
        .
      </p>

      <p className="mt-8 text-sm text-gray-500">Last updated: July 2026.</p>
    </div>
  );
}
