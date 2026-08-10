import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getProductBySlug, getSimilarProducts, visitorTier } from "@/lib/catalog";
import { CATEGORY_GROUPS } from "@/lib/categories";
import { resolveDisplayCurrency } from "@/lib/display-currency";
import { formatDisplayPrice } from "@/lib/currency";
import { CurrencyNote } from "@/components/site/currency-note";
import { Badge, StockBadge, VerificationBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Reveal } from "@/components/ui/reveal";
import { SpotlightGroup } from "@/components/ui/spotlight";
import { ProductImage } from "@/components/catalog/product-image";
import { ProductCard } from "@/components/catalog/product-card";
import { PriceBreakTable } from "@/components/catalog/price-break-table";
import { QuantityStepper } from "@/components/catalog/quantity-stepper";
import { fill, stockLabel, tierLabel, verificationLabel } from "@/components/catalog/labels";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/product/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const product = await getProductBySlug(slug, lang);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description ?? undefined,
  };
}

export default async function ProductPage({ params }: PageProps<"/[lang]/product/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();

  const [dict, product, tier, display] = await Promise.all([
    getDictionary(lang),
    getProductBySlug(slug, lang),
    visitorTier(),
    resolveDisplayCurrency(lang),
  ]);
  if (!product) notFound();

  const similar = await getSimilarProducts(product, lang, 4);
  const specs = Object.entries(product.specs);
  const group = product.category
    ? CATEGORY_GROUPS.find((g) => g.key === product.category?.groupKey)
    : undefined;
  // Route to the quotation desk with the product prefilled. (The route is
  // /quote, not /rfq.)
  const rfqBase =
    `/${lang}/quote?sku=${encodeURIComponent(product.sku)}` +
    `&name=${encodeURIComponent(product.name)}`;
  const moqWaived = product.moq > 1 && product.effectiveMoq === 1;

  return (
    <div className="mx-auto max-w-[82rem] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <li>
            <Link
              href={`/${lang}/catalog`}
              className="cursor-pointer rounded transition-colors duration-200 hover:text-accent-300"
            >
              {dict.catalog.title}
            </Link>
          </li>
          {group ? (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  href={`/${lang}/category/${group.slug}`}
                  className="cursor-pointer rounded transition-colors duration-200 hover:text-accent-300"
                >
                  {lang === "zh" ? group.nameZh : group.nameEn}
                </Link>
              </li>
            </>
          ) : null}
          <li aria-hidden="true">/</li>
          <li className="max-w-full truncate text-ink-300">{product.name}</li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
        {/* ── Gallery ──────────────────────────────────────────────────── */}
        <section
          aria-label={dict.product.gallery}
          className="lg:sticky lg:top-24 lg:self-start"
        >
          <div className="panel group overflow-hidden">
            <ProductImage
              src={product.image}
              alt={product.name}
              sku={product.sku}
              groupKey={product.category?.groupKey}
              categoryLabel={product.category?.name}
              priority
              sizes="(min-width: 1024px) 40vw, 92vw"
            />
          </div>
          {product.images.length === 0 ? (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-ink-500">
              <span className="inline-block size-1 rounded-full bg-ink-600" aria-hidden="true" />
              {dict.product.noImage}
            </p>
          ) : null}
          {product.images.length > 1 ? (
            <ul className="mt-3 flex gap-3 overflow-x-auto pb-1">
              {product.images.slice(0, 6).map((src, index) => (
                <li key={src} className="w-20 shrink-0">
                  <div className="panel overflow-hidden">
                    <ProductImage
                      src={src}
                      alt={fill(dict.product.viewImage, { index: index + 1 })}
                      sku={product.sku}
                      groupKey={product.category?.groupKey}
                      categoryLabel={product.category?.name}
                      sizes="80px"
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {/* ── Buy box ──────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <StockBadge
              status={product.stockStatus}
              label={stockLabel(product.stockStatus, dict)}
            />
            {product.supplier ? (
              <VerificationBadge
                level={product.supplier.verification}
                label={verificationLabel(product.supplier.verification, dict)}
              />
            ) : null}
            {product.featured ? (
              <Badge tone="accent">
                <Icon name="spark" className="size-3" />
              </Badge>
            ) : null}
          </div>

          <div>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-ink-50 sm:text-3xl">
              {product.name}
            </h1>
            <dl className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <dt className="text-ink-500">{dict.product.sku}</dt>
                <dd className="font-mono tracking-wider text-ink-200">{product.sku}</dd>
              </div>
              {product.leadTimeDays ? (
                <div className="flex items-center gap-2">
                  <dt className="text-ink-500">{dict.product.leadTime}</dt>
                  <dd className="text-ink-200">
                    {fill(dict.product.leadTimeDays, { days: product.leadTimeDays })}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <dt className="text-ink-500">{dict.product.unit}</dt>
                <dd className="text-ink-200">{product.unit}</dd>
              </div>
            </dl>
          </div>

          {product.supplier ? (
            <Link
              href={`/${lang}/catalog?supplier=${encodeURIComponent(product.supplier.slug)}`}
              className="panel panel-hover group flex cursor-pointer items-center gap-3 p-4"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-ink-300">
                <Icon name="factory" className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-ink-500">{dict.product.supplier}</span>
                <span className="block truncate text-sm font-semibold text-ink-100">
                  {product.supplier.name}
                </span>
              </span>
              {product.supplier.country ? (
                <span className="shrink-0 text-xs text-ink-500">{product.supplier.country}</span>
              ) : null}
              <Icon
                name="arrow-right"
                className="size-4 shrink-0 text-ink-600 transition-transform duration-300 group-hover:translate-x-1"
              />
            </Link>
          ) : null}

          {/* Price */}
          <div className="panel spotlight p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              {dict.catalog.yourPrice}
            </p>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-4xl font-semibold tabular-nums text-ink-50">
                {formatDisplayPrice(product.yourCents, display)}
              </span>
              <span className="text-sm text-ink-500">{dict.common.perUnit}</span>
              {product.savingCents > 0 ? (
                <span className="font-mono text-base tabular-nums text-ink-500 line-through">
                  {formatDisplayPrice(product.listCents, display)}
                </span>
              ) : null}
            </p>

            <p className="mt-3 text-sm text-ink-400">
              {moqWaived
                ? dict.product.moqWaivedNote
                : fill(dict.product.moqNote, { qty: product.effectiveMoq })}
            </p>

            {product.savingCents > 0 ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl border border-settled-500/25 bg-settled-500/10 px-3.5 py-2.5 text-sm font-medium text-settled-400">
                <Icon name="check" className="size-4 shrink-0" />
                {fill(dict.product.tierSaving, {
                  amount: formatDisplayPrice(product.savingCents, display),
                  tier: tierLabel(tier, dict),
                })}
              </p>
            ) : null}

            {product.upgradeSavingCents > 0 ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-400/25 bg-accent-500/8 px-3.5 py-3">
                <p className="flex items-center gap-2 text-sm font-medium text-accent-200">
                  <Icon name="bolt" className="size-4 shrink-0" />
                  {fill(dict.product.upgradeToSave, {
                    amount: formatDisplayPrice(product.upgradeSavingCents, display),
                  })}
                </p>
                <ButtonLink href={`/${lang}/membership`} variant="secondary" size="sm">
                  {dict.product.upgradeCta}
                </ButtonLink>
              </div>
            ) : null}
          </div>

          <QuantityStepper
            moq={product.effectiveMoq}
            ladder={product.ladder}
            orderHref={`${rfqBase}&intent=order`}
            quoteHref={rfqBase}
            display={display}
            labels={{
              qty: dict.product.qty,
              decrease: dict.product.decrease,
              increase: dict.product.increase,
              unitPrice: dict.catalog.yourPrice,
              lineTotal: dict.product.lineTotal,
              addToOrder: dict.product.addToOrder,
              requestQuote: dict.product.requestQuote,
              perUnit: dict.catalog.unitShort,
              units: dict.common.units,
            }}
          />

          <p className="text-xs leading-relaxed text-ink-500">{dict.product.priceNote}</p>
          <CurrencyNote display={display} dict={dict} />
        </section>
      </div>

      {/* ── Quantity breaks ────────────────────────────────────────────── */}
      <section className="mt-16" aria-labelledby="breaks-heading">
        <h2 id="breaks-heading" className="type-h3 text-ink-50">
          {dict.product.quantityBreaks}
        </h2>
        <div className="mt-4">
          <PriceBreakTable
            ladder={product.ladder}
            dict={dict}
            unit={product.unit}
            showSavings={product.savingCents > 0}
            display={display}
          />
        </div>
      </section>

      {/* ── Specs + description ────────────────────────────────────────── */}
      <div className="mt-16 grid gap-10 lg:grid-cols-2 lg:gap-12">
        <section aria-labelledby="specs-heading">
          <h2 id="specs-heading" className="type-h3 text-ink-50">
            {dict.product.specifications}
          </h2>
          {specs.length > 0 ? (
            <div className="mt-4 overflow-x-auto rounded-[calc(var(--radius-card)-1px)] border border-white/8">
              <table className="w-full min-w-[20rem] border-collapse text-sm">
                <caption className="sr-only">{dict.product.specifications}</caption>
                <tbody>
                  {specs.map(([key, value], index) => (
                    <tr
                      key={key}
                      className={index === 0 ? undefined : "border-t border-white/6"}
                    >
                      <th
                        scope="row"
                        className="w-2/5 bg-white/[0.02] px-4 py-3 text-left font-medium text-ink-400"
                      >
                        {key}
                      </th>
                      <td className="px-4 py-3 text-ink-100">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-ink-400">{dict.product.specsEmpty}</p>
          )}
        </section>

        <section aria-labelledby="description-heading">
          <h2 id="description-heading" className="type-h3 text-ink-50">
            {dict.product.description}
          </h2>
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-300">
            {product.description ?? dict.product.descriptionEmpty}
          </p>
        </section>
      </div>

      {/* ── Similar ────────────────────────────────────────────────────── */}
      <section className="mt-16" aria-labelledby="similar-heading">
        <h2 id="similar-heading" className="type-h3 text-ink-50">
          {dict.product.similar}
        </h2>
        {similar.length > 0 ? (
          <SpotlightGroup
            as="ul"
            className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {similar.map((item, index) => (
              <Reveal key={item.id} as="li" delay={index * 50}>
                <ProductCard product={item} lang={lang} dict={dict} display={display} />
              </Reveal>
            ))}
          </SpotlightGroup>
        ) : (
          <p className="mt-4 text-sm text-ink-400">{dict.product.similarEmpty}</p>
        )}
      </section>

      <div className="mt-12 border-t border-white/8 pt-8">
        <ButtonLink href={`/${lang}/catalog`} variant="ghost">
          <Icon name="arrow-right" className="size-4 rotate-180" />
          {dict.product.backToCatalog}
        </ButtonLink>
      </div>
    </div>
  );
}
