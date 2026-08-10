import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { CATEGORY_GROUPS, groupBlurb, groupName, groupSamples } from "@/lib/categories";
import { countProductsByGroup } from "@/lib/catalog";
import { Icon } from "@/components/ui/icon";
import { Reveal } from "@/components/ui/reveal";
import { SpotlightGroup } from "@/components/ui/spotlight";
import { SectionHead } from "@/components/marketing/section-head";
import { fill } from "@/components/catalog/labels";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/categories">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.categories.title, description: dict.categories.lead };
}

export default async function CategoriesPage({ params }: PageProps<"/[lang]/categories">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const [dict, counts] = await Promise.all([getDictionary(lang), countProductsByGroup()]);

  return (
    <div className="grain relative mx-auto max-w-[92rem] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div
        className="grid-mesh radial-fade pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 opacity-50"
        aria-hidden="true"
      />
      <SectionHead
        eyebrow={dict.nav.categories}
        title={dict.categories.title}
        lead={dict.categories.lead}
      />

      {/* Same bento weighting as the home page: electronics leads the catalog,
          so its tile spans two columns. Each tile carries an oversized ghost of
          its own icon so the eight groups read as distinct "worlds". */}
      <SpotlightGroup className="mt-12 grid auto-rows-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORY_GROUPS.map((group, index) => {
          const count = counts[group.key] ?? 0;
          return (
            <Reveal
              key={group.slug}
              delay={index * 55}
              className={group.span === 2 ? "sm:col-span-2" : undefined}
            >
              <Link
                href={`/${lang}/category/${group.slug}`}
                data-cursor="view:OPEN"
                className="panel panel-hover spotlight trace group relative flex h-full cursor-pointer flex-col overflow-hidden p-6"
              >
                {/* Category-world watermark. */}
                <Icon
                  name={group.icon}
                  className="pointer-events-none absolute -right-6 -top-4 size-40 text-white/[0.025] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:text-accent-400/[0.06] group-hover:-translate-y-1"
                />

                <div className="relative flex items-start justify-between gap-4">
                  <span className="inline-flex size-12 items-center justify-center rounded-xl border border-accent-400/25 bg-accent-500/10 text-accent-300 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110">
                    <Icon name={group.icon} />
                  </span>
                  <span className="font-mono text-xs tabular-nums text-ink-500">
                    {count > 0 ? fill(dict.categories.productsCount, { count }) : "—"}
                  </span>
                </div>

                <h2 className="type-h3 relative mt-5 text-ink-50">{groupName(group, lang)}</h2>
                <p className="relative mt-2 flex-1 text-sm leading-relaxed text-ink-400">
                  {groupBlurb(group, lang)}
                </p>

                <div className="relative mt-5 flex flex-wrap gap-1.5">
                  {groupSamples(group, lang).map((sample) => (
                    <span
                      key={sample}
                      className="rounded-md border border-white/8 bg-white/[0.03] px-2 py-1 text-[11px] font-medium text-ink-400 transition-colors duration-300 group-hover:border-accent-400/20"
                    >
                      {sample}
                    </span>
                  ))}
                </div>

                <span className="relative mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-300">
                  {dict.categories.explore}
                  <Icon
                    name="arrow-right"
                    className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                  />
                </span>
              </Link>
            </Reveal>
          );
        })}
      </SpotlightGroup>
    </div>
  );
}
