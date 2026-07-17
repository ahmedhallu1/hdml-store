import Image from "next/image";
import Link from "next/link";
import { waLink } from "@/lib/egypt";
import { getSiteSettings } from "@/lib/settings";

const colTitle = "text-sm font-semibold uppercase tracking-wide text-gray-900";
const colLink = "text-sm text-gray-600 hover:text-brand-700";

/** Storefront footer: contact channels, policy links and the payment note. */
export async function Footer() {
  const { contact, seller_info, branding } = await getSiteSettings();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Image
              src="/brand/logo-tight.png"
              alt={branding.store_name}
              width={103}
              height={24}
              className="h-6 w-auto"
            />
            <p className="mt-3 text-sm text-gray-600">{branding.tagline}</p>
          </div>

          <nav aria-label="Store">
            <h2 className={colTitle}>Store</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/catalog" className={colLink}>
                  Catalog
                </Link>
              </li>
              <li>
                <Link href="/contact" className={colLink}>
                  Contact us
                </Link>
              </li>
              <li>
                <Link href="/delivery" className={colLink}>
                  Delivery information
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Policies">
            <h2 className={colTitle}>Policies</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/returns" className={colLink}>
                  Returns &amp; exchanges
                </Link>
              </li>
              <li>
                <Link href="/privacy" className={colLink}>
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className={colLink}>
                  Terms of service
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className={colTitle}>Get in touch</h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li>
                <a href={`tel:${contact.phone}`} className="hover:text-brand-700">
                  Phone: {contact.phone}
                </a>
              </li>
              <li>
                <a
                  href={waLink(contact.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-700"
                >
                  WhatsApp: {contact.whatsapp}
                </a>
              </li>
              <li>
                <a href={`mailto:${contact.email}`} className="break-all hover:text-brand-700">
                  {contact.email}
                </a>
              </li>
              <li className="pt-1 text-xs text-gray-500">{seller_info.address}</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-gray-200 pt-6">
          <p className="text-xs text-gray-500">
            © {year} {branding.store_name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
