import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "About us",
  description:
    "HDML is a registered Egyptian wholesaler of electronics and accessories — bulk prices, delivery across Egypt, and manual Instapay/wallet payment verified personally.",
};

export default async function AboutPage() {
  const { branding, seller_info, delivery } = await getSiteSettings();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">About {branding.store_name}</h1>

      <p className="mt-4 text-lg leading-relaxed text-gray-700">
        {branding.store_name} is an Egyptian wholesaler of electronics and accessories — from phone
        cases, chargers and cables to earbuds, storage, networking gear and more. We supply
        businesses, shops and resellers across {delivery.regions} at genuine bulk prices.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { n: "8,000+", l: "products in stock and growing" },
          { n: "All Egypt", l: "delivery within a few working days" },
          { n: "Wholesale", l: "bulk pricing with per-product minimums" },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-gray-200 bg-white p-5 text-center">
            <p className="text-2xl font-bold text-brand-700">{s.n}</p>
            <p className="mt-1 text-sm text-gray-600">{s.l}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-xl font-semibold text-gray-900">How we work</h2>
      <p className="mt-2 leading-relaxed text-gray-700">
        Browse the catalog, add what you need, and place your order online. Payment is simple and
        direct — you transfer the total by <strong>Instapay or mobile wallet</strong> and upload a
        screenshot. There are no card gateways and no hidden fees: every payment is checked by a
        real person before your order is confirmed and shipped. It keeps costs down and prices honest.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-gray-900">A business you can trust</h2>
      <p className="mt-2 leading-relaxed text-gray-700">
        {branding.store_name} is operated by {seller_info.name} and is a registered business with the
        Egyptian Tax Authority (Tax Registration No. {seller_info.tax_id}), based at{" "}
        {seller_info.address}. Full legal terms are on our{" "}
        <Link href="/terms" className="font-medium text-brand-700 hover:text-brand-600">
          terms page
        </Link>
        .
      </p>

      <div className="mt-10 rounded-xl border border-brand-200 bg-brand-50/50 p-6">
        <h2 className="text-lg font-semibold text-gray-900">Ready to order?</h2>
        <p className="mt-1 text-sm text-gray-600">
          Explore the full catalog, or reach out and we&rsquo;ll help you with a bulk quote.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/catalog"
            className="inline-flex h-11 items-center rounded-lg bg-brand-700 px-5 font-medium text-white transition hover:bg-brand-600"
          >
            Browse the catalog
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-11 items-center rounded-lg border border-brand-200 px-5 font-medium text-brand-800 transition hover:bg-brand-50"
          >
            Contact us
          </Link>
        </div>
      </div>
    </div>
  );
}
