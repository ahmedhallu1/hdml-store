import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import type { MarketplaceStats } from "@/lib/catalog";
import { interpolate } from "@/lib/validation";
import { TradeNetwork } from "@/components/site/trade-network";
import { HeroSearch } from "@/components/site/hero-search";
import { SplitLines } from "@/components/ui/split-lines";
import { Reveal } from "@/components/ui/reveal";
import { Counter } from "@/components/ui/counter";
import { Magnetic } from "@/components/ui/magnetic";
import { Icon } from "@/components/ui/icon";
import { ButtonLink } from "@/components/ui/button";

const SUGGESTIONS_EN = ["Chargers", "Power banks", "LED lighting", "Cables", "Smart watches"];
const SUGGESTIONS_ZH = ["充电器", "移动电源", "LED 照明", "数据线", "智能手表"];

/**
 * Homepage hero.
 *
 * Composition: copy occupies the left seven columns, the live trade network
 * bleeds off the right edge, and a full-width instrument rail of real
 * marketplace figures anchors the bottom. Below `lg` the scene moves behind
 * the copy at low opacity instead of being dropped — it still supplies
 * atmosphere without competing with the headline for a narrow column.
 *
 * Every figure in the rail is queried from the catalogue (see
 * `marketplaceStats`); tiles whose value is 0 are omitted rather than shown as
 * a placeholder.
 */
export function Hero({
  lang,
  dict,
  stats,
}: {
  lang: Locale;
  dict: Dictionary;
  stats: MarketplaceStats;
}) {
  const zh = lang === "zh";

  // The headline's line breaks are authored, not measured — see SplitLines.
  const titleLines = zh
    ? ["全球批发", "从这里开始"]
    : ["Global Wholesale", "Starts Here"];

  const rail: Array<{ label: string; value: React.ReactNode; hint: string }> = [];
  if (stats.products > 0) {
    rail.push({
      label: dict.home.statProducts,
      value: <Counter to={stats.products} />,
      hint: zh ? "在售 SKU" : "Live SKUs",
    });
  }
  if (stats.categories > 0) {
    rail.push({
      label: dict.home.statCategories,
      value: <Counter to={stats.categories} />,
      hint: zh ? "八大类目" : "Across 8 groups",
    });
  }
  if (stats.suppliers > 0) {
    rail.push({
      label: dict.home.statSuppliers,
      value: <Counter to={stats.suppliers} />,
      hint:
        stats.supplierCountries > 0
          ? zh
            ? `${stats.supplierCountries} 个国家/地区`
            : `${stats.supplierCountries} countries`
          : zh
            ? "已上线"
            : "Listed",
    });
  }
  rail.push({
    label: dict.home.statLeadTime,
    value: <span className="tabular-nums">15–30{zh ? "天" : "d"}</span>,
    hint: zh ? "发货后" : "After dispatch",
  });

  return (
    <section className="grain relative isolate overflow-hidden">
      {/* ── Atmosphere ─────────────────────────────────────────────────── */}
      <div className="grid-mesh radial-fade absolute inset-0 -z-10" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -left-40 top-[-10%] -z-10 h-[36rem] w-[36rem] rounded-full bg-accent-600/10 blur-[130px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-obsidian-900"
        aria-hidden="true"
      />

      {/*
        The scene. On small screens it sits centred behind the copy at low
        opacity; from lg it becomes the right half of the composition.
      */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-30 sm:opacity-40 lg:left-auto lg:right-[-12%] lg:top-1/2 lg:h-[52rem] lg:w-[52rem] lg:-translate-y-1/2 lg:opacity-95"
        aria-hidden="true"
      >
        <TradeNetwork />
      </div>

      <div className="relative mx-auto max-w-[92rem] px-4 pb-16 pt-24 sm:px-6 lg:px-8 lg:pb-20 lg:pt-32">
        <div className="max-w-2xl lg:max-w-3xl">
          <Reveal>
            <span className="inline-flex items-center gap-2.5 rounded-full border border-accent-400/25 bg-accent-500/[0.08] py-1.5 pl-2.5 pr-4 backdrop-blur-sm">
              <span className="relative flex size-1.5">
                <span className="pulse-ring absolute inline-flex size-full rounded-full bg-accent-400" />
                <span className="relative inline-flex size-1.5 rounded-full bg-accent-300" />
              </span>
              <span className="type-eyebrow text-accent-200">{dict.home.heroKicker}</span>
            </span>
          </Reveal>

          <h1 className="type-display mt-7 text-ink-50">
            <SplitLines
              lines={titleLines}
              delay={140}
              stagger={110}
              lineClassName="text-gradient-still"
            />
          </h1>

          <Reveal delay={420}>
            <p className="type-lead mt-7 max-w-xl text-ink-400">{dict.home.heroLead}</p>
          </Reveal>

          <Reveal delay={520} className="mt-10">
            <HeroSearch
              lang={lang}
              /* The count comes from the catalogue, never from the copy. */
              placeholder={interpolate(dict.home.searchPlaceholder, {
                count: stats.products.toLocaleString("en-US"),
              })}
              cta={dict.home.searchCta}
              popularLabel={dict.home.popularSearches}
              suggestions={zh ? SUGGESTIONS_ZH : SUGGESTIONS_EN}
            />
          </Reveal>

          <Reveal delay={600} className="mt-9 flex flex-wrap items-center gap-3">
            <Magnetic>
              <ButtonLink href={`/${lang}/catalog`} size="lg">
                {dict.home.primaryCta}
                <Icon name="arrow-right" className="size-4" />
              </ButtonLink>
            </Magnetic>
            <ButtonLink href={`/${lang}/suppliers/apply`} variant="secondary" size="lg">
              {dict.home.secondaryCta}
            </ButtonLink>
          </Reveal>
        </div>

        {/* ── Instrument rail ────────────────────────────────────────────── */}
        <Reveal delay={700} className="mt-20 lg:mt-28">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.07] backdrop-blur-md lg:grid-cols-4">
            {rail.map((stat, i) => (
              <div
                key={stat.label}
                className="group relative bg-obsidian-900/85 px-5 py-6 transition-colors duration-300 hover:bg-obsidian-800/85 sm:px-6 sm:py-7"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-px scale-x-0 bg-gradient-to-r from-transparent via-accent-400 to-transparent transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100"
                />
                <dt className="type-eyebrow text-ink-600">{stat.label}</dt>
                <dd className="mt-3 font-mono text-3xl font-semibold text-accent-300 sm:text-[2.1rem]">
                  {stat.value}
                </dd>
                <p className="mt-1.5 text-xs text-ink-600">{stat.hint}</p>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-4 top-4 font-mono text-[10px] text-ink-700"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
