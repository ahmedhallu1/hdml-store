import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import {
  listCategories,
  listSuppliers,
  parseCatalogQuery,
  searchProducts,
  type CatalogQuery,
} from "@/lib/catalog";
import { resolveDisplayCurrency } from "@/lib/display-currency";
import { CurrencyNote } from "@/components/site/currency-note";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Reveal } from "@/components/ui/reveal";
import { SpotlightGroup } from "@/components/ui/spotlight";
import { ProductCard } from "@/components/catalog/product-card";
import { FilterPanel } from "@/components/catalog/filter-panel";
import { SortSelect } from "@/components/catalog/sort-select";
import { Pagination } from "@/components/catalog/pagination";
import { fill, sortLabel, stockLabel } from "@/components/catalog/labels";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/catalog">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.catalog.title, description: dict.catalog.lead };
}

export default async function CatalogPage({ params, searchParams }: PageProps<"/[lang]/catalog">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const [dict, sp] = await Promise.all([getDictionary(lang), searchParams]);
  const query = parseCatalogQuery(sp);
  const action = `/${lang}/catalog`;

  // The filter facets are small lookups; the product page is the expensive one.
  // Issuing them together keeps the request to a single round of waiting.
  const [results, categories, suppliers, display] = await Promise.all([
    searchProducts(query, lang),
    listCategories(lang),
    listSuppliers(),
    resolveDisplayCurrency(lang),
  ]);

  const filterParams = paramsFor(query, { sort: false, page: false });
  const pageParams = paramsFor(query, { sort: true, page: false });
  const chips = activeChips(query, categories, suppliers, dict, action);
  const from = (results.page - 1) * results.pageSize + 1;
  const to = Math.min(results.total, results.page * results.pageSize);

  return (
    <div className="grain relative mx-auto max-w-[92rem] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div
        className="grid-mesh radial-fade pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 opacity-50"
        aria-hidden="true"
      />
      <header className="max-w-3xl">
        <Reveal>
          <p className="type-eyebrow flex items-center gap-3 text-accent-400/90">
            <span className="text-ink-700">{results.total.toLocaleString("en-US")}</span>
            <span aria-hidden="true" className="h-px w-8 bg-gradient-to-r from-accent-400/60 to-transparent" />
            {dict.nav.catalog}
          </p>
        </Reveal>
        <Reveal delay={70}>
          <h1 className="type-h2 mt-4 text-ink-50">{dict.catalog.title}</h1>
        </Reveal>
        <Reveal delay={130}>
          <p className="type-lead mt-4 text-ink-400">{dict.catalog.lead}</p>
        </Reveal>
        <Reveal delay={180}>
          <CurrencyNote display={display} dict={dict} className="mt-3 max-w-xl" />
        </Reveal>
      </header>

      <div className="mt-10 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
        <aside aria-label={dict.catalog.filters}>
          <FilterPanel
            dict={dict}
            query={query}
            categories={categories}
            suppliers={suppliers}
            action={action}
            activeCount={chips.length}
          />
        </aside>

        <section aria-label={dict.catalog.title}>
          <div className="flex flex-col gap-4 border-b border-white/8 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-xs tabular-nums text-ink-400" aria-live="polite">
              {results.total > 0
                ? fill(dict.catalog.resultsRange, {
                    from,
                    to,
                    count: results.total.toLocaleString("en-US"),
                  })
                : fill(dict.catalog.resultsCount, { count: 0 })}
            </p>
            <SortSelect
              action={action}
              params={filterParams}
              value={query.sort}
              label={dict.catalog.sortBy}
              applyLabel={dict.catalog.applyFilters}
              optionLabels={{
                relevance: sortLabel("relevance", dict),
                price_asc: sortLabel("price_asc", dict),
                price_desc: sortLabel("price_desc", dict),
                newest: sortLabel("newest", dict),
              }}
            />
          </div>

          {chips.length > 0 ? (
            <ul
              aria-label={dict.catalog.activeFilters}
              className="mt-4 flex flex-wrap items-center gap-2"
            >
              {chips.map((chip) => (
                <li key={chip.key}>
                  <Link
                    href={chip.href}
                    className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-accent-400/30 bg-accent-500/10 px-3 py-1.5 text-xs font-medium text-accent-200 transition-colors duration-200 hover:border-accent-400/60 hover:bg-accent-500/20"
                  >
                    <span>{chip.label}</span>
                    <span className="sr-only">{dict.catalog.removeFilter}</span>
                    <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
                      <path
                        d="m3 3 6 6M9 3l-6 6"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {results.items.length > 0 ? (
            <>
              <SpotlightGroup
                as="ul"
                className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
              >
                {results.items.map((product, index) => (
                  <Reveal key={product.id} as="li" delay={Math.min(index, 8) * 40}>
                    <ProductCard
                      product={product}
                      lang={lang}
                      dict={dict}
                      display={display}
                      priority={index < 4}
                    />
                  </Reveal>
                ))}
              </SpotlightGroup>
              <Pagination
                action={action}
                params={pageParams}
                page={results.page}
                totalPages={results.totalPages}
                dict={dict}
              />
            </>
          ) : (
            <EmptyState
              lang={lang}
              filtered={chips.length > 0}
              title={chips.length > 0 ? dict.catalog.noResults : dict.catalog.emptyCatalog}
              body={chips.length > 0 ? dict.catalog.noResultsHint : dict.catalog.emptyCatalogHint}
              primary={{ href: `/${lang}/categories`, label: dict.catalog.browseCategories }}
              secondary={{ href: action, label: dict.catalog.browseAll }}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  body,
  primary,
  secondary,
  filtered,
}: {
  lang: string;
  filtered: boolean;
  title: string;
  body: string;
  primary: { href: string; label: string };
  secondary: { href: string; label: string };
}) {
  return (
    <div className="panel mt-6 flex flex-col items-center px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-ink-400">
        <Icon name="search" className="size-6" />
      </span>
      <h2 className="mt-5 text-lg font-bold text-ink-50">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-400">{body}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href={primary.href} variant="secondary">
          {primary.label}
        </ButtonLink>
        {filtered ? <ButtonLink href={secondary.href}>{secondary.label}</ButtonLink> : null}
      </div>
    </div>
  );
}

/** Query → querystring record. `page` is dropped so any change resets to page 1. */
function paramsFor(
  query: CatalogQuery,
  include: { sort: boolean; page: boolean },
): Record<string, string> {
  const out: Record<string, string> = {};
  if (query.q) out.q = query.q;
  if (query.category) out.category = query.category;
  if (query.supplier) out.supplier = query.supplier;
  if (query.stock) out.stock = query.stock;
  if (query.minUsd !== null) out.min = String(query.minUsd);
  if (query.maxUsd !== null) out.max = String(query.maxUsd);
  if (include.sort && query.sort !== "relevance") out.sort = query.sort;
  if (include.page && query.page > 1) out.page = String(query.page);
  return out;
}

interface Chip {
  key: string;
  label: string;
  href: string;
}

/** One removable chip per active filter, each linking to the URL without it. */
function activeChips(
  query: CatalogQuery,
  categories: Array<{ slug: string; name: string }>,
  suppliers: Array<{ slug: string; name: string }>,
  dict: Awaited<ReturnType<typeof getDictionary>>,
  action: string,
): Chip[] {
  const chips: Chip[] = [];
  const without = (drop: Partial<Record<keyof CatalogQuery, true>>) => {
    const next = paramsFor(
      {
        ...query,
        q: drop.q ? "" : query.q,
        category: drop.category ? "" : query.category,
        supplier: drop.supplier ? "" : query.supplier,
        stock: drop.stock ? null : query.stock,
        minUsd: drop.minUsd ? null : query.minUsd,
        maxUsd: drop.maxUsd ? null : query.maxUsd,
      },
      { sort: true, page: false },
    );
    const qs = new URLSearchParams(next).toString();
    return qs ? `${action}?${qs}` : action;
  };

  if (query.q) chips.push({ key: "q", label: `“${query.q}”`, href: without({ q: true }) });
  if (query.category) {
    const name = categories.find((c) => c.slug === query.category)?.name ?? query.category;
    chips.push({ key: "category", label: name, href: without({ category: true }) });
  }
  if (query.supplier) {
    const name = suppliers.find((s) => s.slug === query.supplier)?.name ?? query.supplier;
    chips.push({ key: "supplier", label: name, href: without({ supplier: true }) });
  }
  if (query.stock) {
    chips.push({
      key: "stock",
      label: stockLabel(query.stock, dict),
      href: without({ stock: true }),
    });
  }
  if (query.minUsd !== null || query.maxUsd !== null) {
    const min = query.minUsd !== null ? `$${query.minUsd}` : "—";
    const max = query.maxUsd !== null ? `$${query.maxUsd}` : "—";
    chips.push({
      key: "price",
      label: `${min} – ${max}`,
      href: without({ minUsd: true, maxUsd: true }),
    });
  }
  return chips;
}
