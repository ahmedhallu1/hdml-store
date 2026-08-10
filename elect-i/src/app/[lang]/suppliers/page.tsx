import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { listSuppliers } from "@/lib/catalog";
import { VerificationBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Reveal } from "@/components/ui/reveal";
import { SpotlightGroup } from "@/components/ui/spotlight";
import { SectionHead } from "@/components/marketing/section-head";
import { fill, verificationLabel } from "@/components/catalog/labels";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/suppliers">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.suppliers.title, description: dict.suppliers.lead };
}

export default async function SuppliersPage({ params }: PageProps<"/[lang]/suppliers">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const [dict, suppliers] = await Promise.all([getDictionary(lang), listSuppliers()]);

  // Network figures, all derived from the real supplier rows.
  const countries = new Set(
    suppliers.map((s) => s.country?.trim()).filter((c): c is string => Boolean(c)),
  );
  const verifiedCount = suppliers.filter((s) => s.verification !== "unverified").length;
  const zh = lang === "zh";
  const network = [
    { label: zh ? "供应商" : "Suppliers", value: suppliers.length },
    { label: zh ? "国家/地区" : "Countries", value: countries.size },
    { label: zh ? "已核验" : "Verified", value: verifiedCount },
  ];

  return (
    <div className="grain relative mx-auto max-w-[92rem] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div
        className="grid-mesh radial-fade pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 opacity-50"
        aria-hidden="true"
      />
      <SectionHead
        eyebrow={zh ? "供应网络" : "Supply network"}
        title={dict.suppliers.title}
        lead={dict.suppliers.lead}
      />

      {suppliers.length > 0 ? (
        <Reveal delay={120}>
          <dl className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06]">
            {network.map((item) => (
              <div key={item.label} className="bg-obsidian-900/85 px-5 py-5 text-center sm:text-left">
                <dt className="type-eyebrow text-ink-600">{item.label}</dt>
                <dd className="mt-2 font-mono text-2xl font-semibold text-accent-300 sm:text-3xl">
                  {item.value.toLocaleString("en-US")}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      ) : null}

      {/*
        Amber verification badges are a strong trust signal, so the scope of the
        claim is stated on the same screen rather than buried in the legal
        pages: labels describe documents received, not audits performed.
      */}
      <div className="panel mt-6 flex gap-3 border-verify-500/20 p-4">
        <Icon name="shield" className="size-5 shrink-0 text-verify-400" />
        <div>
          <p className="text-sm font-semibold text-ink-100">{dict.suppliers.verificationTitle}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-400">
            {dict.suppliers.verificationNote}
          </p>
        </div>
      </div>

      {suppliers.length > 0 ? (
        <SpotlightGroup
          as="ul"
          className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {suppliers.map((supplier, index) => (
            <Reveal key={supplier.id} as="li" delay={Math.min(index, 8) * 45}>
              <article className="panel panel-hover spotlight flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-bold leading-snug text-ink-50">
                    {supplier.name}
                  </h2>
                  <VerificationBadge
                    level={supplier.verification}
                    label={verificationLabel(supplier.verification, dict)}
                  />
                </div>

                {supplier.country || supplier.city ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-400">
                    <Icon name="globe" className="size-3.5 shrink-0" />
                    {[supplier.city, supplier.country].filter(Boolean).join(", ")}
                  </p>
                ) : null}

                {supplier.description ? (
                  <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-400">
                    {supplier.description}
                  </p>
                ) : (
                  <div className="flex-1" />
                )}

                <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-white/8 bg-white/[0.06] text-center">
                  <Stat
                    label={dict.suppliers.listings}
                    value={
                      supplier.productCount === null
                        ? "—"
                        : supplier.productCount.toLocaleString("en-US")
                    }
                  />
                  <Stat
                    label={dict.suppliers.responseRate}
                    value={supplier.responseRate === null ? "—" : `${supplier.responseRate}%`}
                  />
                  <Stat
                    label={dict.suppliers.leadTime}
                    value={
                      supplier.leadTimeDays === null
                        ? "—"
                        : fill(dict.product.leadTimeDays, { days: supplier.leadTimeDays })
                    }
                  />
                </dl>

                <Link
                  href={`/${lang}/catalog?supplier=${encodeURIComponent(supplier.slug)}`}
                  className="mt-4 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/5 px-4 text-sm font-semibold text-ink-100 transition-all duration-200 hover:border-accent-400/40 hover:bg-white/10"
                >
                  {dict.suppliers.viewListings}
                  <Icon name="arrow-right" className="size-4" />
                </Link>
              </article>
            </Reveal>
          ))}
        </SpotlightGroup>
      ) : (
        <div className="panel mt-8 flex flex-col items-center px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-ink-400">
            <Icon name="factory" className="size-6" />
          </span>
          <h2 className="mt-5 text-lg font-bold text-ink-50">{dict.suppliers.empty}</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-400">
            {dict.catalog.emptyCatalogHint}
          </p>
          <ButtonLink href={`/${lang}/catalog`} variant="secondary" className="mt-6">
            {dict.catalog.browseAll}
          </ButtonLink>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-obsidian-900 px-2 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">{label}</dt>
      <dd className="mt-1 font-mono text-sm text-ink-100">{value}</dd>
    </div>
  );
}
