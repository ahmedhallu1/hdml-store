import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { company } from "@/config/company";
import { CATEGORY_GROUPS, groupBlurb, groupName, groupSamples } from "@/lib/categories";
import { countProductsByGroup, marketplaceStats } from "@/lib/catalog";
import { TIER_PRICING, TIER_PRIVILEGES } from "@/lib/tiers";
import { resolveDisplayCurrency } from "@/lib/display-currency";
import { formatDisplayPrice } from "@/lib/currency";
import { CurrencyNote } from "@/components/site/currency-note";
import { Hero } from "@/components/marketing/hero";
import { Journey, type JourneyStep } from "@/components/marketing/journey";
import { ApiFlow } from "@/components/marketing/api-flow";
import { SectionHead } from "@/components/marketing/section-head";
import { Reveal } from "@/components/ui/reveal";
import { SpotlightGroup } from "@/components/ui/spotlight";
import { Magnetic } from "@/components/ui/magnetic";
import { Icon, type IconName } from "@/components/ui/icon";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const zh = lang === "zh";

  // Both are cached per request and read the live catalogue — nothing on this
  // page states a figure that is not in the database.
  const [stats, groupCounts, display] = await Promise.all([
    marketplaceStats(),
    countProductsByGroup(),
    resolveDisplayCurrency(lang),
  ]);

  const steps: JourneyStep[] = [
    { icon: "search", title: dict.home.how1Title, body: dict.home.how1Body },
    { icon: "wallet", title: dict.home.how2Title, body: dict.home.how2Body },
    { icon: "link", title: dict.home.how3Title, body: dict.home.how3Body },
    { icon: "truck", title: dict.home.how4Title, body: dict.home.how4Body },
  ];

  return (
    <>
      <Hero lang={lang} dict={dict} stats={stats} />

      {/* ── Categories ───────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 py-20 lg:py-28">
        <div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-8">
          <SectionHead
            index="01"
            eyebrow={zh ? "类目" : "Categories"}
            title={dict.home.categoriesTitle}
            lead={dict.home.categoriesLead}
          />

          <SpotlightGroup className="mt-14 grid auto-rows-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORY_GROUPS.map((group, i) => {
              const count = groupCounts[group.key] ?? 0;
              return (
                <Reveal
                  key={group.slug}
                  delay={i * 55}
                  className={group.span === 2 ? "sm:col-span-2" : undefined}
                >
                  <Link
                    href={`/${lang}/category/${group.slug}`}
                    data-cursor="view:OPEN"
                    className="panel panel-hover spotlight trace group flex h-full flex-col overflow-hidden p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="inline-flex size-12 items-center justify-center rounded-xl border border-accent-400/25 bg-accent-500/10 text-accent-300 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110">
                        <Icon name={group.icon} />
                      </span>
                      {count > 0 ? (
                        <span className="font-mono text-xs tabular-nums text-ink-600">
                          {count.toLocaleString("en-US")}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="type-h3 mt-5 text-ink-50">{groupName(group, lang)}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-500">
                      {groupBlurb(group, lang)}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-1.5">
                      {groupSamples(group, lang).map((sample) => (
                        <span
                          key={sample}
                          className="rounded-md border border-white/8 bg-white/[0.03] px-2 py-1 text-[11px] font-medium text-ink-500 transition-colors duration-300 group-hover:border-accent-400/20 group-hover:text-ink-400"
                        >
                          {sample}
                        </span>
                      ))}
                    </div>

                    <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 transition-colors duration-300 group-hover:text-accent-300">
                      {dict.common.viewAll}
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
      </section>

      {/* ── Journey ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-white/8 py-20 lg:py-28">
        <div className="grid-mesh radial-fade absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-8">
          <SectionHead
            index="02"
            eyebrow={zh ? "流程" : "How it works"}
            title={dict.home.howTitle}
            lead={dict.home.howLead}
          />
          <div className="mt-14">
            <Journey steps={steps} />
          </div>
        </div>
      </section>

      {/* ── Membership ───────────────────────────────────────────────── */}
      <section className="border-t border-white/8 py-20 lg:py-28">
        <div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-8">
          <SectionHead
            index="03"
            eyebrow={zh ? "会员" : "Membership"}
            title={dict.home.tiersTitle}
            lead={dict.home.tiersLead}
          />

          <SpotlightGroup className="mt-14 grid gap-4 lg:grid-cols-3">
            {(
              [
                { tier: "buyer" as const, name: dict.tiers.buyerName, tagline: dict.tiers.buyerTagline },
                { tier: "merchant" as const, name: dict.tiers.merchantName, tagline: dict.tiers.merchantTagline },
                { tier: "elite" as const, name: dict.tiers.eliteName, tagline: dict.tiers.eliteTagline },
              ]
            ).map((plan, i) => {
              const priv = TIER_PRIVILEGES[plan.tier];
              const price = TIER_PRICING[plan.tier];
              const featured = plan.tier === "merchant";
              return (
                <Reveal key={plan.tier} delay={i * 80}>
                  {/* Wrapper stays overflow-visible so the floating badge is
                      never clipped by the featured card's `sweep` (which needs
                      overflow:hidden for its light bar). */}
                  <div className="relative h-full">
                    {featured ? (
                      <span className="absolute -top-3 left-7 z-20">
                        <Badge tone="accent">{dict.tiers.mostPopular}</Badge>
                      </span>
                    ) : null}
                    <div
                      className={
                        featured
                          ? "panel spotlight sweep h-full border-accent-400/40 p-7 [box-shadow:0_0_0_1px_rgba(23,200,210,.2),0_20px_60px_-20px_rgba(6,166,180,.4)]"
                          : "panel spotlight h-full p-7"
                      }
                    >
                    <h3 className="type-h3 text-ink-50">{plan.name}</h3>
                    <p className="mt-2 min-h-10 text-sm leading-relaxed text-ink-500">
                      {plan.tagline}
                    </p>
                    <p className="mt-6 flex items-baseline gap-1.5">
                      <span className="font-mono text-4xl font-semibold text-ink-50">
                        {price.monthlyCents === 0
                          ? dict.common.free
                          : formatDisplayPrice(price.monthlyCents, display)}
                      </span>
                      {price.monthlyCents > 0 ? (
                        <span className="text-sm text-ink-500">/{dict.tiers.perMonth}</span>
                      ) : null}
                    </p>

                    <ul className="mt-7 space-y-2.5 text-sm">
                      <Feature
                        label={dict.tiers.featureDiscount}
                        value={priv.discountBps === 0 ? "—" : `−${priv.discountBps / 100}%`}
                        on={priv.discountBps > 0}
                      />
                      <Feature
                        label={dict.tiers.featureOnBehalf}
                        value={
                          priv.onBehalfOrdersPerMonth === null
                            ? dict.tiers.unlimited
                            : priv.onBehalfOrdersPerMonth === 0
                              ? "—"
                              : String(priv.onBehalfOrdersPerMonth)
                        }
                        on={priv.canOrderOnBehalf}
                      />
                      <Feature
                        label={dict.tiers.featureApi}
                        value={
                          priv.apiAccess === "none"
                            ? dict.tiers.apiNone
                            : priv.apiAccess === "read"
                              ? dict.tiers.apiRead
                              : dict.tiers.apiFull
                        }
                        on={priv.apiAccess !== "none"}
                      />
                      <Feature
                        label={dict.tiers.featureMoq}
                        value={
                          priv.moqPolicy === "full"
                            ? dict.tiers.moqFull
                            : priv.moqPolicy === "reduced"
                              ? dict.tiers.moqReduced
                              : dict.tiers.moqWaived
                        }
                        on={priv.moqPolicy !== "full"}
                      />
                      <Feature
                        label={dict.tiers.featureCoBrand}
                        value={priv.coBrandedClaimPage ? dict.common.yes : "—"}
                        on={priv.coBrandedClaimPage}
                      />
                    </ul>

                    <ButtonLink
                      href={`/${lang}/membership`}
                      variant={featured ? "primary" : "secondary"}
                      className="mt-8 w-full"
                    >
                      {dict.tiers.choosePlan}
                    </ButtonLink>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </SpotlightGroup>

          <CurrencyNote display={display} dict={dict} className="mx-auto mt-8 max-w-2xl text-center" />
        </div>
      </section>

      {/* ── API ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-white/8 py-20 lg:py-28">
        <div
          className="pointer-events-none absolute right-0 top-1/3 h-96 w-96 rounded-full bg-accent-600/[0.08] blur-[120px]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <SectionHead
                index="04"
                eyebrow={zh ? "开发者" : "Developers"}
                title={dict.home.apiTitle}
                lead={dict.home.apiLead}
              />
              <Reveal delay={190} className="mt-8 flex flex-wrap gap-3">
                <Magnetic>
                  <ButtonLink href={`/${lang}/developers`} variant="secondary">
                    {dict.home.apiCta}
                    <Icon name="arrow-right" className="size-4" />
                  </ButtonLink>
                </Magnetic>
              </Reveal>

              <Reveal delay={250} className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  { icon: "shield" as IconName, label: zh ? "HMAC 签名" : "HMAC-signed" },
                  { icon: "bolt" as IconName, label: zh ? "幂等重试" : "Idempotent" },
                  { icon: "link" as IconName, label: zh ? "Webhook" : "Webhooks" },
                ].map((chip) => (
                  <span
                    key={chip.label}
                    className="panel-flat inline-flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-ink-400"
                  >
                    <Icon name={chip.icon} className="size-4 text-accent-400" />
                    {chip.label}
                  </span>
                ))}
              </Reveal>
            </div>

            <Reveal delay={120}>
              <ApiFlow
                labels={{
                  request: zh ? "请求" : "Request",
                  response: zh ? "响应" : "Response",
                  webhook: "Webhook",
                  signed: zh ? "已签名请求" : "signed request",
                }}
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── How we work (honest capability disclosure) ───────────────── */}
      <section className="border-t border-white/8 py-20 lg:py-28">
        <div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-8">
          <SectionHead
            index="05"
            eyebrow={zh ? "透明度" : "Transparency"}
            title={dict.home.trustTitle}
            lead={dict.home.trustLead}
          />

          <SpotlightGroup className="mt-14 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: "shield" as IconName,
                title: zh ? "谁是卖方" : "Who you're buying from",
                body: company.operator.disclosure,
              },
              {
                icon: "truck" as IconName,
                title: zh ? "配送与关税" : "Delivery and duties",
                body: zh
                  ? "由快递或货运代理配送，发货后通常 15–30 天送达。价格不含目的地清关费用与进口关税。"
                  : "A courier or freight forwarder handles delivery, typically 15–30 days after dispatch. Prices exclude customs clearance and import duties at the destination.",
              },
              {
                icon: "check" as IconName,
                title: zh ? "订单核验" : "Order verification",
                body: zh
                  ? "每个预付认领链接都附带签名摘要，收货人可逐行核对本订单与原订单是否完全一致。"
                  : "Every prepaid claim link carries a signed digest, so the recipient can verify line by line that this order matches the one they originally placed.",
              },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 70}>
                <div className="panel spotlight h-full p-6">
                  <span className="inline-flex size-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-ink-300">
                    <Icon name={item.icon} className="size-5" />
                  </span>
                  <h3 className="mt-4 font-bold text-ink-50">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-500">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </SpotlightGroup>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="grain relative overflow-hidden border-t border-white/8 py-24 lg:py-32">
        <div className="grid-mesh radial-fade absolute inset-0 opacity-50" aria-hidden="true" />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-500/10 blur-[110px]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Reveal>
            <h2 className="type-h2 text-ink-50">{dict.home.ctaTitle}</h2>
          </Reveal>
          <Reveal delay={90}>
            <p className="type-lead mt-5 text-ink-400">{dict.home.ctaLead}</p>
          </Reveal>
          <Reveal delay={160} className="mt-10 flex flex-wrap justify-center gap-3">
            <Magnetic>
              <ButtonLink href={`/${lang}/register`} size="lg">
                {dict.nav.register}
                <Icon name="arrow-right" className="size-4" />
              </ButtonLink>
            </Magnetic>
            <ButtonLink href={`/${lang}/contact`} variant="secondary" size="lg">
              {dict.nav.contact}
            </ButtonLink>
          </Reveal>
          <Reveal delay={230}>
            <p className="type-eyebrow mt-12 text-accent-500/70">{company.slogan}</p>
          </Reveal>
        </div>
      </section>
    </>
  );
}

function Feature({ label, value, on }: { label: string; value: string; on: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-white/5 pb-2.5 last:border-0">
      <span className="text-ink-500">{label}</span>
      <span className={on ? "font-semibold text-accent-300" : "text-ink-600"}>{value}</span>
    </li>
  );
}
