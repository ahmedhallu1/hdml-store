import type { Metadata } from "next";
import { waLink } from "@/lib/egypt";
import { getSiteSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with HDML by phone, WhatsApp or email for wholesale orders and support.",
};

export default async function ContactPage() {
  const { contact, seller_info } = await getSiteSettings();

  const channels = [
    {
      title: "WhatsApp",
      note: "Fastest response — send your order reference for order questions.",
      href: waLink(contact.whatsapp),
      label: contact.whatsapp,
      external: true,
    },
    {
      title: "Phone",
      note: "Call us during business hours for urgent matters.",
      href: `tel:${contact.phone}`,
      label: contact.phone,
      external: false,
    },
    {
      title: "Email",
      note: "Best for detailed enquiries, bulk quotes and documents.",
      href: `mailto:${contact.email}`,
      label: contact.email,
      external: false,
    },
    ...(contact.telegram
      ? [
          {
            title: "Telegram",
            note: "Message us on Telegram for quick chats and updates.",
            href: `https://t.me/${contact.telegram.replace(/^@/, "")}`,
            label: contact.telegram.startsWith("@") ? contact.telegram : `@${contact.telegram}`,
            external: true,
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Contact us</h1>
      <p className="mt-3 leading-relaxed text-gray-600">
        Questions about a product, an order, or a large-quantity quote? Reach us on any of the
        channels below — WhatsApp is usually the fastest.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {channels.map((channel) => (
          <a
            key={channel.title}
            href={channel.href}
            {...(channel.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="rounded-xl border border-gray-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-md"
          >
            <h2 className="text-sm font-semibold text-gray-900">{channel.title}</h2>
            <p className="mt-1 break-all text-sm font-medium text-brand-700">{channel.label}</p>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">{channel.note}</p>
          </a>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-5">
        <h2 className="text-sm font-semibold text-gray-900">Business details</h2>
        <dl className="mt-3 space-y-2 text-sm text-gray-600">
          <div>
            <dt className="inline font-medium text-gray-700">Seller: </dt>
            <dd className="inline">{seller_info.name}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-gray-700">Address: </dt>
            <dd className="inline">{seller_info.address}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-gray-700">Tax ID: </dt>
            <dd className="inline">{seller_info.tax_id}</dd>
          </div>
        </dl>
      </div>

      <p className="mt-6 text-sm leading-relaxed text-gray-500">
        We typically respond Saturday to Thursday, 10:00–22:00 (Cairo time). Messages sent outside
        these hours are answered the next working day. Payment verifications are handled in the
        order they arrive.
      </p>
    </div>
  );
}
