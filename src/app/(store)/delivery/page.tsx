import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Delivery",
  description: "HDML delivery coverage, timelines, fees and how order tracking works.",
};

const h2 = "mt-8 text-xl font-semibold text-gray-900";
const p = "mt-2 leading-relaxed text-gray-700";

export default async function DeliveryPage() {
  const { delivery, contact } = await getSiteSettings();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Delivery information</h1>
      <p className="mt-3 leading-relaxed text-gray-600">
        Everything you need to know about where we deliver, how long it takes, and how to follow
        your order.
      </p>

      <h2 className={h2}>Where we deliver</h2>
      <p className={p}>
        We deliver across <strong>{delivery.regions}</strong> — every governorate, including remote
        areas. You provide your governorate and full address at checkout; if a courier needs extra
        directions we contact you on the phone number on the order.
      </p>

      <h2 className={h2}>How long it takes</h2>
      <p className={p}>
        Orders ship after your payment is verified and typically arrive within{" "}
        <strong>{delivery.time}</strong>. Bulk orders with many cartons can occasionally take a
        little longer — if that happens we tell you in advance rather than leave you guessing.
      </p>

      <h2 className={h2}>Delivery fees</h2>
      <p className={p}>{delivery.fee_note}</p>

      <h2 className={h2}>How tracking works</h2>
      <p className={p}>
        After you place an order you receive an email with your order reference and a private
        tracking link. The link works without logging in — anyone with it can view the order
        status, so treat it like a receipt. Your order moves through these stages:
      </p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-gray-700">
        <li>
          <strong>Awaiting payment</strong> — transfer the total via Instapay or mobile wallet.
        </li>
        <li>
          <strong>Awaiting verification</strong> — you uploaded a transfer proof and our team is
          checking it manually.
        </li>
        <li>
          <strong>Paid</strong> — payment confirmed; we prepare and dispatch your shipment.
        </li>
        <li>
          <strong>Fulfilled</strong> — the order was delivered.
        </li>
      </ol>

      <h2 className={h2}>Receiving your shipment</h2>
      <p className={p}>
        Please inspect the cartons when they arrive and report any visible damage or shortage to us
        on WhatsApp ({contact.whatsapp}) within 48 hours, ideally with photos — see our{" "}
        <Link href="/returns" className="font-medium text-brand-700 hover:text-brand-600">
          returns policy
        </Link>{" "}
        for details.
      </p>
    </div>
  );
}
