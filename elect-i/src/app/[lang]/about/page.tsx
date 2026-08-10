import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { company } from "@/config/company";
import { CATEGORY_GROUPS, groupName } from "@/lib/categories";
import {
  PageHero,
  Section,
  SectionHeader,
  FeatureCard,
  DisclosureNote,
  CtaBand,
} from "@/components/marketing/section";
import { StatStrip } from "@/components/marketing/stat-strip";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Icon } from "@/components/ui/icon";
import type { GlyphName } from "@/components/marketing/glyph";

export const metadata: Metadata = { title: "About" };

export default async function AboutPage({ params }: PageProps<"/[lang]/about">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const a = dict.about;

  const doItems: Array<{ icon: GlyphName; title: string; body: string }> = [
    { icon: "search", title: a.do1Title, body: a.do1Body },
    { icon: "file-text", title: a.do2Title, body: a.do2Body },
    { icon: "link", title: a.do3Title, body: a.do3Body },
    { icon: "ship", title: a.do4Title, body: a.do4Body },
  ];
  const buildItems: Array<{ icon: GlyphName; title: string; body: string }> = [
    { icon: "lock", title: a.build1Title, body: a.build1Body },
    { icon: "clipboard", title: a.build2Title, body: a.build2Body },
    { icon: "layers", title: a.build3Title, body: a.build3Body },
    { icon: "globe", title: a.build4Title, body: a.build4Body },
  ];

  return (
    <>
      <PageHero kicker={a.kicker} title={a.title} lead={a.lead}>
        <StatStrip
          items={[
            { label: a.statGroups, value: "8" },
            { label: a.statTiers, value: "3" },
            { label: a.statDelivery, value: a.statDeliveryValue },
            { label: a.statCurrency, value: "USD" },
          ]}
        />
      </PageHero>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <SectionHeader kicker={a.kicker} title={a.storyTitle} />
          <Reveal delay={80} className="space-y-4 text-[15px] leading-relaxed text-ink-300">
            <p>{a.storyBody1}</p>
            <p>{a.storyBody2}</p>
          </Reveal>
        </div>
      </Section>

      <Section mesh>
        <SectionHeader title={a.coverageTitle} lead={a.coverageLead} />
        <div className="mt-10 flex flex-wrap gap-2.5">
          {CATEGORY_GROUPS.map((group, i) => (
            <Reveal key={group.slug} delay={Math.min(i, 8) * 30}>
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-ink-200">
                <Icon name={group.icon} className="size-4 text-accent-300" />
                {groupName(group, lang)}
              </span>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeader title={a.doTitle} lead={a.doLead} />
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {doItems.map((item, i) => (
            <Reveal key={item.title} delay={i * 60}>
              <FeatureCard icon={item.icon} title={item.title} body={item.body} />
            </Reveal>
          ))}
        </div>
      </Section>

      <Section mesh>
        <SectionHeader title={a.honestTitle} lead={a.honestLead} />
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          <Reveal>
            <DisclosureNote title={a.honest1Title} icon="shield">
              <p>{a.honest1Body}</p>
            </DisclosureNote>
          </Reveal>
          <Reveal delay={70}>
            <DisclosureNote title={a.honest2Title} icon="ship">
              <p>{a.honest2Body}</p>
            </DisclosureNote>
          </Reveal>
          <Reveal delay={140}>
            <DisclosureNote title={a.honest3Title} icon="check">
              <p>{a.honest3Body}</p>
            </DisclosureNote>
          </Reveal>
        </div>

        {/* The operator disclosure comes straight from config, never invented. */}
        <Reveal delay={80} className="mt-4">
          <DisclosureNote title={a.operatorTitle} icon="building">
            <p>{company.operator.disclosure}</p>
            <p className="text-ink-500">{a.operatorBody}</p>
          </DisclosureNote>
        </Reveal>
      </Section>

      <Section>
        <SectionHeader title={a.buildTitle} lead={a.buildLead} />
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {buildItems.map((item, i) => (
            <Reveal key={item.title} delay={i * 60}>
              <FeatureCard icon={item.icon} title={item.title} body={item.body} tone="neutral" />
            </Reveal>
          ))}
        </div>
      </Section>

      <CtaBand title={a.ctaTitle} lead={a.ctaLead}>
        <ButtonLink href={`/${lang}/catalog`} size="lg">
          {dict.home.primaryCta}
        </ButtonLink>
        <ButtonLink href={`/${lang}/membership`} variant="secondary" size="lg">
          {dict.nav.pricing}
        </ButtonLink>
      </CtaBand>
    </>
  );
}
