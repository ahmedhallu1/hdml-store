import type { Metadata } from "next";
import { waLink } from "@/lib/egypt";
import { getSiteSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Returns & Exchanges",
  description: "HDML wholesale returns policy: inspection on delivery, defect reporting and refunds.",
};

const h2 = "mt-8 text-xl font-semibold text-gray-900";
const p = "mt-2 leading-relaxed text-gray-700";

export default async function ReturnsPage() {
  const { contact } = await getSiteSettings();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Returns &amp; exchanges</h1>
      <p className="mt-3 leading-relaxed text-gray-600">
        We sell wholesale, so our returns process is built around inspection on delivery and fast
        defect reporting — the sooner you tell us, the faster we fix it.
      </p>

      <h2 className={h2}>1. Inspect on delivery</h2>
      <p className={p}>
        Check the cartons and item count when your shipment arrives. If a carton is visibly
        damaged or the count is short, note it with the courier and contact us the same day.
      </p>

      <h2 className={h2}>2. Report within 48 hours</h2>
      <p className={p}>
        Report damaged, defective or wrong items within{" "}
        <strong>48 hours of receiving your order</strong>. Contact us any way that suits you —
        WhatsApp at{" "}
        <a
          href={waLink(contact.whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-700 hover:text-brand-600"
        >
          {contact.whatsapp}
        </a>
        , phone, email or Telegram — with your <strong>order ID</strong> and clear photos of the
        item and its packaging. Reports made after 48 hours are handled case by case.
      </p>

      <h2 className={h2}>3. What we cover</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-6 text-gray-700">
        <li>
          <strong>Manufacturing defects</strong> — replaced or refunded after we receive and verify
          the defective units.
        </li>
        <li>
          <strong>Wrong items shipped</strong> — we collect the wrong items and send the correct
          ones at our cost.
        </li>
        <li>
          <strong>Transit damage or shortage</strong> — reported on delivery, replaced or credited
          against your next order.
        </li>
      </ul>

      <h2 className={h2}>4. What we can&apos;t take back</h2>
      <p className={p}>
        Because these are bulk goods sold at wholesale prices, we cannot accept change-of-mind
        returns on items that have been opened, used, unsealed or had their retail packaging
        damaged. Unopened stock in resellable condition may be returnable by prior agreement —
        message us before shipping anything back.
      </p>

      <h2 className={h2}>5. Refunds</h2>
      <p className={p}>
        Approved refunds are sent by Instapay or mobile-wallet transfer to the same number the
        payment came from, within 5 working days of us receiving and inspecting the returned goods.
        Replacement shipments follow the normal delivery timeline.{" "}
        <strong>Customs clearance and import duties are non-refundable.</strong>
      </p>
    </div>
  );
}
