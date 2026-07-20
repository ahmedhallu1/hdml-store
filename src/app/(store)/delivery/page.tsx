import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Delivery",
  description: "How HDML orders are delivered by courier, timelines, fees and order tracking.",
};

const h2 = "mt-8 text-xl font-semibold text-gray-900";
const p = "mt-2 leading-relaxed text-gray-700";

export default async function DeliveryPage() {
  const { delivery, contact } = await getSiteSettings();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Delivery information</h1>
      <p className="mt-3 leading-relaxed text-gray-600">
        Everything you need to know about how your order reaches you, how long it takes, and how to
        follow it.
      </p>

      <h2 className={h2}>How delivery works</h2>
      <p className={p}>
        Delivery is handled by a <strong>courier service</strong>, available across{" "}
        <strong>{delivery.regions}</strong> — every governorate, including remote areas. After your
        payment is confirmed, you complete your order and provide your delivery address on a
        separate platform through the link we send you, and the courier service then contacts you
        with the next steps.
      </p>

      <h2 className={h2}>How long it takes</h2>
      <p className={p}>
        Delivery time depends on several factors — your location, customs clearance and the courier
        — but is typically <strong>{delivery.time}</strong> once your payment is confirmed and your
        order is completed. The courier keeps you posted.
      </p>

      <h2 className={h2}>Delivery fees</h2>
      <p className={p}>{delivery.fee_note}</p>

      <h2 className={h2}>Customs &amp; duties</h2>
      <p className={p}>
        Prices on this site do <strong>not</strong> include customs clearance or import duties. Any
        customs charges are the buyer&rsquo;s responsibility, and customs fees are non-refundable.
      </p>

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
          <strong>Paid</strong> — payment confirmed. We send you a link to complete your order and
          shipping details; a courier service then handles delivery and contacts you with the next
          steps.
        </li>
      </ol>

      <h2 className={h2}>Receiving your shipment</h2>
      <p className={p}>
        Please inspect the cartons when they arrive and report any visible damage or shortage within
        48 hours — contact us any way (WhatsApp {contact.whatsapp}, phone, email or Telegram) with
        your order ID and photos. See our{" "}
        <Link href="/returns" className="font-medium text-brand-700 hover:text-brand-600">
          returns policy
        </Link>{" "}
        for details.
      </p>
    </div>
  );
}
