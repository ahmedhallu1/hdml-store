import Link from "next/link";
import { listCategories, listProducts } from "@/lib/catalog";
import { getSiteSettings } from "@/lib/settings";
import { ProductCard } from "@/components/site/product-card";
import { CatalogImage } from "@/components/site/catalog-image";
import { publicImageUrl } from "@/lib/image-url";

const STEPS = [
  {
    title: "Browse & add to cart",
    text: "Search thousands of wholesale products and add what you need — minimum order quantities apply per product.",
  },
  {
    title: "Place your order",
    text: "Check out with just an optional note and your payment method. You receive an order reference and a private tracking link by email.",
  },
  {
    title: "Pay via Instapay or wallet",
    text: "Transfer the order total to our Instapay or mobile wallet number from your own banking or wallet app.",
  },
  {
    title: "Upload proof — we verify",
    text: "Upload your transfer screenshot. Our team verifies it manually and emails your receipt once confirmed.",
  },
];

export default async function HomePage() {
  const [settings, categories, latest] = await Promise.all([
    getSiteSettings(),
    listCategories(),
    listProducts({ sort: "newest", page: 1 }),
  ]);
  const latestProducts = latest.items.slice(0, 8);

  return (
    <div className="rise-in">
      {/* Hero */}
      <section className="bg-brand-700">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-100">
              {settings.branding.store_name} — wholesale, direct
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">
              {settings.branding.tagline}
            </h1>
            <p className="mt-4 text-base text-brand-100 sm:text-lg">
              Bulk prices in EGP across {settings.delivery.regions}. Pay by Instapay or mobile
              wallet — no cards, no gateways, verified personally.
            </p>

            <form action="/catalog" method="get" role="search" className="mt-8 flex max-w-xl gap-2">
              <label htmlFor="hero-search" className="sr-only">
                Search products
              </label>
              <input
                id="hero-search"
                type="search"
                name="q"
                placeholder="Search chargers, cables, earbuds…"
                autoComplete="off"
                className="h-12 w-full rounded-lg border-0 bg-white px-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
              <button
                type="submit"
                className="h-12 shrink-0 rounded-lg bg-accent-500 px-5 font-medium text-brand-950 transition hover:brightness-95"
              >
                Search
              </button>
            </form>

            <div className="mt-6">
              <Link
                href="/catalog"
                className="inline-flex h-12 items-center rounded-lg bg-white px-6 font-medium text-brand-800 transition hover:bg-brand-50"
              >
                Browse the full catalog
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section aria-labelledby="categories-heading" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 id="categories-heading" className="text-2xl font-bold tracking-tight text-gray-900">
          Shop by category
        </h2>
        {categories.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">Categories are being set up — check back soon.</p>
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/category/${category.slug}`}
                  className="group block overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-brand-300 hover:shadow-md"
                >
                  <div className="aspect-square w-full overflow-hidden bg-gray-50">
                    <CatalogImage
                      src={publicImageUrl(`_category/${category.slug}.png`)}
                      alt={category.name}
                      icon={category.icon}
                      className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <p className="p-3 text-center text-sm font-medium text-gray-800 group-hover:text-brand-700">
                    {category.name}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Latest products */}
      <section aria-labelledby="latest-heading" className="mx-auto max-w-7xl px-4 py-4 pb-12 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <h2 id="latest-heading" className="text-2xl font-bold tracking-tight text-gray-900">
            Latest products
          </h2>
          <Link href="/catalog" className="text-sm font-medium text-brand-700 hover:text-brand-600">
            View all →
          </Link>
        </div>
        {latestProducts.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">Products are on their way — check back soon.</p>
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {latestProducts.map((product) => (
              <li key={product.id} className="flex">
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* How ordering works */}
      <section aria-labelledby="how-heading" className="border-y border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 id="how-heading" className="text-2xl font-bold tracking-tight text-gray-900">
            How ordering works
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            No online card payments — every order is paid by a manual transfer and verified by a
            real person before it ships.
          </p>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-xl border border-gray-200 bg-white p-5">
                <span
                  aria-hidden
                  className="flex size-8 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white"
                >
                  {i + 1}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
