import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { CATEGORY_GROUPS, groupBlurb, groupName, groupSamples } from "@/lib/categories";
import {
  listCategories,
  listSuppliers,
  parseCatalogQuery,
  searchProducts,
  type CatalogQuery,
} from "@/lib/catalog";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Reveal } from "@/components/ui/reveal";
import { ProductCard } from "@/components/catalog/product-card";
import { resolveDisplayCurrency } from "@/lib/display-currency";
import { CurrencyNote } from "@/components/site/currency-note";
import { FilterPanel } from "@/components/catalog/filter-panel";
import { SortSelect } from "@/components/catalog/sort-select";
import { Pagination } from "@/components/catalog/pagination";
import { fill, sortLabel } from "@/components/catalog/labels";

/** The eight groups are fixed in code, so an unknown slug is a real 404. */
function groupFor(slug: string) {
  return CATEGORY_GROUPS.find((group) => group.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/category/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const group = groupFor(slug);
  if (!group) return {};
  return { title: groupName(group, lang), description: groupBlurb(group, lang) };
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/[lang]/category/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const group = groupFor(slug);
  if (!group) notFound();

  const [dict, sp] = await Promise.all([getDictionary(lang), searchParams]);
  // The category is fixed by the route, so it is stripped from the query.
  const query: CatalogQuery = { ...parseCatalogQuery(sp), category: "" };
  const action = `/${lang}/category/${slug}`;

  const [results, categories, suppliers, display] = await Promise.all([
    searchProducts(query, lang, { groupKey: group.key }),
    listCategories(lang),
    listSuppliers(),
    resolveDisplayCurrency(lang),
  ]);

  const filterParams = paramsFor(query, false);
  const pageParams = paramsFor(query, true);
  const activeCount = countActive(query);

  return (
    <div>
      {/* ── Group hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-white/8">
        <div className="grid-mesh radial-fade absolute inset-0" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-accent-500/10 blur-[110px]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
              <li>
                <Link
                  href={`/${lang}/categories`}
                  className="cursor-pointer rounded transition-colors duration-200 hover:text-accent-300"
                >
                  {dict.categories.title}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-ink-300">{groupName(group, lang)}</li>
            </ol>
          </nav>

          <Reveal className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex size-14 items-center justify-center rounded-2xl border border-accent-400/25 bg-accent-500/10 text-accent-300">
                <Icon name={group.icon} className="size-7" />
              </span>
              <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                {groupName(group, lang)}
              </h1>
              <p className="mt-4 text-base leading-relaxed text-ink-400 sm:text-lg">
                {groupBlurb(group, lang)}
              </p>
              <div className="mt-5 flex flex-wrap gap-1.5">
                {groupSamples(group, lang).map((sample) => (
                  <span
                    key={sample}
                    className="rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-ink-400"
                  >
                    {sample}
                  </span>
                ))}
              </div>
            </div>

            <div className="panel shrink-0 px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                {dict.categories.inThisGroup}
              </p>
              <p className="mt-2 font-mono text-3xl font-semibold text-accent-300">
                {results.total.toLocaleString("en-US")}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Listings ───────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <CurrencyNote display={display} dict={dict} className="mb-6 max-w-xl" />
        <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
          <aside aria-label={dict.catalog.filters}>
            <FilterPanel
              dict={dict}
              query={query}
              categories={categories}
              suppliers={suppliers}
              action={action}
              lockCategory
              activeCount={activeCount}
            />
          </aside>

          <section aria-label={groupName(group, lang)}>
            <div className="flex flex-col gap-4 border-b border-white/8 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-400" aria-live="polite">
                {fill(dict.catalog.resultsCount, {
                  count: results.total.toLocaleString("en-US"),
                })}
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

            {results.items.length > 0 ? (
              <>
                <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
                </ul>
                <Pagination
                  action={action}
                  params={pageParams}
                  page={results.page}
                  totalPages={results.totalPages}
                  dict={dict}
                />
              </>
            ) : (
              <div className="panel mt-6 flex flex-col items-center px-6 py-16 text-center">
                <span className="grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-ink-400">
                  <Icon name={group.icon} className="size-6" />
                </span>
                <h2 className="mt-5 text-lg font-bold text-ink-50">
                  {activeCount > 0 ? dict.catalog.noResults : dict.categories.empty}
                </h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-400">
                  {activeCount > 0 ? dict.catalog.noResultsHint : dict.catalog.emptyCatalogHint}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <ButtonLink href={action} variant="secondary">
                    {dict.catalog.clearFilters}
                  </ButtonLink>
                  <ButtonLink href={`/${lang}/catalog`}>{dict.catalog.browseAll}</ButtonLink>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function paramsFor(query: CatalogQuery, includeSort: boolean): Record<string, string> {
  const out: Record<string, string> = {};
  if (query.q) out.q = query.q;
  if (query.supplier) out.supplier = query.supplier;
  if (query.stock) out.stock = query.stock;
  if (query.minUsd !== null) out.min = String(query.minUsd);
  if (query.maxUsd !== null) out.max = String(query.maxUsd);
  if (includeSort && query.sort !== "relevance") out.sort = query.sort;
  return out;
}

function countActive(query: CatalogQuery): number {
  let n = 0;
  if (query.q) n += 1;
  if (query.supplier) n += 1;
  if (query.stock) n += 1;
  if (query.minUsd !== null || query.maxUsd !== null) n += 1;
  return n;
}
