import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { TIER_PRICING, TIER_PRIVILEGES, MIN_ORDER_CENTS, isTier, type Tier } from "@/lib/tiers";
import { resolveDisplayCurrency } from "@/lib/display-currency";
import { formatDisplayPrice } from "@/lib/currency";
import { CurrencyNote } from "@/components/site/currency-note";
import { PageHero, Section, SectionHeader, CtaBand } from "@/components/marketing/section";
import { PricingToggle } from "@/components/marketing/pricing-toggle";
import { ComparisonTable, type ComparisonGroup } from "@/components/marketing/comparison-table";
import { Faq } from "@/components/marketing/faq";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";

export const metadata: Metadata = { title: "Membership" };

const TIER_ORDER: Tier[] = ["buyer", "merchant", "elite"];

export default async function MembershipPage({ params, searchParams }: PageProps<"/[lang]/membership">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const [sp, dict, display] = await Promise.all([
    searchParams,
    getDictionary(lang),
    resolveDisplayCurrency(lang),
  ]);
  const m = dict.membership;
  const t = dict.tiers;

  const upgradeRaw = Array.isArray(sp.upgrade) ? sp.upgrade[0] : sp.upgrade;
  const highlightTier = upgradeRaw && isTier(upgradeRaw) ? upgradeRaw : null;

  const tierName = (tier: Tier) =>
    tier === "elite" ? t.eliteName : tier === "merchant" ? t.merchantName : t.buyerName;

  const plans = [
    {
      tier: "buyer" as Tier,
      name: t.buyerName,
      tagline: t.buyerTagline,
      highlights: [t.featureRfq + ": 3", t.featureMoq + ": " + t.moqFull, t.featureAnalytics + ": " + t.apiNone],
    },
    {
      tier: "merchant" as Tier,
      name: t.merchantName,
      tagline: t.merchantTagline,
      highlights: [
        "−" + TIER_PRIVILEGES.merchant.discountBps / 100 + "% " + t.featureDiscount.toLowerCase(),
        t.featureOnBehalf + ": 20/" + t.perMonth,
        t.featureWallet,
        t.featureApi + ": " + t.apiRead,
      ],
    },
    {
      tier: "elite" as Tier,
      name: t.eliteName,
      tagline: t.eliteTagline,
      highlights: [
        "−" + TIER_PRIVILEGES.elite.discountBps / 100 + "% " + t.featureDiscount.toLowerCase(),
        t.featureOnBehalf + ": " + t.unlimited,
        t.featureApi + ": " + t.apiFull + " + " + t.featureWebhooks,
        t.featureCoBrand,
        t.featureCredit + ": " + formatDisplayPrice(TIER_PRIVILEGES.elite.creditLimitCents, display),
      ],
    },
  ];

  // The comparison matrix is generated from the same constants the engine uses.
  const cell = (text: string, on: boolean) => ({ text, on });
  const yes = (on: boolean) => cell(on ? dict.common.yes : "—", on);
  const byTier = <T,>(fn: (tier: Tier) => T) => TIER_ORDER.map(fn);

  const groups: ComparisonGroup[] = [
    {
      title: m.groupPricing,
      rows: [
        {
          label: m.rowMonthly,
          cells: byTier((tier) =>
            cell(
              TIER_PRICING[tier].monthlyCents === 0 ? dict.common.free : formatDisplayPrice(TIER_PRICING[tier].monthlyCents, display),
              TIER_PRICING[tier].monthlyCents > 0,
            ),
          ),
        },
        {
          label: m.rowAnnual,
          cells: byTier((tier) =>
            cell(
              TIER_PRICING[tier].annualCents === 0 ? dict.common.free : formatDisplayPrice(TIER_PRICING[tier].annualCents, display),
              TIER_PRICING[tier].annualCents > 0,
            ),
          ),
        },
        {
          label: t.featureDiscount,
          cells: byTier((tier) => {
            const bps = TIER_PRIVILEGES[tier].discountBps;
            return cell(bps === 0 ? "—" : `−${bps / 100}%`, bps > 0);
          }),
        },
        {
          label: m.rowMinOrder,
          cells: byTier((tier) =>
            cell(MIN_ORDER_CENTS[tier] === 0 ? t.moqWaived : formatDisplayPrice(MIN_ORDER_CENTS[tier], display), true),
          ),
        },
      ],
    },
    {
      title: m.groupOrdering,
      rows: [
        {
          label: m.rowRfq,
          cells: byTier((tier) => {
            const n = TIER_PRIVILEGES[tier].rfqPerMonth;
            return cell(n === null ? t.unlimited : String(n), true);
          }),
        },
        {
          label: t.featureMoq,
          cells: byTier((tier) => {
            const p = TIER_PRIVILEGES[tier].moqPolicy;
            return cell(p === "full" ? t.moqFull : p === "reduced" ? t.moqReduced : t.moqWaived, p !== "full");
          }),
        },
        {
          label: t.featureSamples,
          cells: byTier((tier) => yes(TIER_PRIVILEGES[tier].sampleOrders)),
        },
        {
          label: t.featureConsolidated,
          cells: byTier((tier) => yes(TIER_PRIVILEGES[tier].consolidatedShipping)),
        },
      ],
    },
    {
      title: m.groupPrepaid,
      rows: [
        {
          label: t.featureOnBehalf,
          cells: byTier((tier) => {
            const n = TIER_PRIVILEGES[tier].onBehalfOrdersPerMonth;
            return cell(n === null ? t.unlimited : n === 0 ? "—" : `${n}/${t.perMonth}`, TIER_PRIVILEGES[tier].canOrderOnBehalf);
          }),
        },
        {
          label: t.featureCoBrand,
          cells: byTier((tier) => yes(TIER_PRIVILEGES[tier].coBrandedClaimPage)),
        },
      ],
    },
    {
      title: m.groupMoney,
      rows: [
        {
          label: t.featureWallet,
          cells: byTier((tier) => yes(TIER_PRIVILEGES[tier].hasWallet)),
        },
        {
          label: t.featureCredit,
          cells: byTier((tier) => {
            const c = TIER_PRIVILEGES[tier].creditLimitCents;
            return cell(c === 0 ? m.prepayOnly : formatDisplayPrice(c, display), c > 0);
          }),
        },
      ],
    },
    {
      title: m.groupPlatform,
      rows: [
        {
          label: t.featureApi,
          cells: byTier((tier) => {
            const a = TIER_PRIVILEGES[tier].apiAccess;
            return cell(a === "none" ? t.apiNone : a === "read" ? t.apiRead : t.apiFull, a !== "none");
          }),
        },
        {
          label: t.featureWebhooks,
          cells: byTier((tier) => yes(TIER_PRIVILEGES[tier].webhooks)),
        },
        {
          label: t.featureSeats,
          cells: byTier((tier) => {
            const s = TIER_PRIVILEGES[tier].seats;
            return cell(s === null ? t.unlimited : m.seatsCount.replace("{count}", String(s)), true);
          }),
        },
        {
          label: t.featureManager,
          cells: byTier((tier) => {
            const mgr = TIER_PRIVILEGES[tier].accountManager;
            return cell(
              mgr === "none" ? t.managerNone : mgr === "shared" ? t.managerShared : t.managerDedicated,
              mgr !== "none",
            );
          }),
        },
        {
          label: t.featureAnalytics,
          cells: byTier((tier) => {
            const an = TIER_PRIVILEGES[tier].analytics;
            return cell(an === "basic" ? m.analyticsBasic : an === "full" ? m.analyticsFull : m.analyticsExport, true);
          }),
        },
      ],
    },
  ];

  const faqs = [
    { q: m.faq1Q, a: m.faq1A },
    { q: m.faq2Q, a: m.faq2A },
    { q: m.faq3Q, a: m.faq3A },
    { q: m.faq4Q, a: m.faq4A },
    { q: m.faq5Q, a: m.faq5A },
    { q: m.faq6Q, a: m.faq6A },
  ];

  return (
    <>
      <PageHero kicker={m.kicker} title={m.title} lead={m.lead} />

      {highlightTier ? (
        <Section className="!py-8">
          <Reveal>
            <div className="rounded-2xl border border-accent-400/30 bg-accent-500/[0.07] p-5">
              <p className="font-semibold text-accent-200">
                {m.upgradeTitle.replace("{tier}", tierName(highlightTier))}
              </p>
              <p className="mt-1 text-sm text-ink-400">
                {m.upgradeBody.replace("{tier}", tierName(highlightTier))}
              </p>
            </div>
          </Reveal>
        </Section>
      ) : null}

      <Section className={highlightTier ? "!border-t-0 !pt-0" : undefined}>
        <PricingToggle
          lang={lang}
          plans={plans}
          highlightTier={highlightTier}
          display={display}
          dict={{
            monthly: t.monthly,
            annual: t.annual,
            annualNote: t.annualNote,
            perMonth: t.perMonth,
            perYear: m.perYear,
            equivalentMonthly: m.equivalentMonthly,
            billedAnnually: m.billedAnnually,
            free: dict.common.free,
            choosePlan: t.choosePlan,
            mostPopular: t.mostPopular,
          }}
        />
        <CurrencyNote display={display} dict={dict} className="mx-auto mt-8 max-w-2xl text-center" />
      </Section>

      <Section mesh>
        <SectionHeader title={m.compareTitle} lead={m.compareLead} />
        <Reveal delay={80} className="mt-8">
          <ComparisonTable
            featureLabel={m.featureColumn}
            columns={TIER_ORDER.map((tier) => ({
              key: tier,
              name: tierName(tier),
              highlight: tier === "merchant",
            }))}
            groups={groups}
          />
        </Reveal>
      </Section>

      <Section>
        <SectionHeader title={m.faqTitle} />
        <Reveal delay={80} className="mt-8 max-w-3xl">
          <Faq items={faqs} />
        </Reveal>
      </Section>

      <CtaBand title={m.ctaTitle} lead={m.ctaLead}>
        <ButtonLink href={`/${lang}/contact`} size="lg">
          {dict.nav.contact}
        </ButtonLink>
        <ButtonLink href={`/${lang}/developers`} variant="secondary" size="lg">
          {m.developersCta}
        </ButtonLink>
      </CtaBand>
    </>
  );
}
