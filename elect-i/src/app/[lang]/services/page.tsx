import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import {
  PageHero,
  Section,
  SectionHeader,
  FeatureCard,
  StepCard,
  DisclosureNote,
  CtaBand,
} from "@/components/marketing/section";
import { Faq } from "@/components/marketing/faq";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import type { GlyphName } from "@/components/marketing/glyph";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage({ params }: PageProps<"/[lang]/services">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const s = dict.services;

  const buyer: Array<{ icon: GlyphName; title: string; body: string }> = [
    { icon: "search", title: s.buyer1Title, body: s.buyer1Body },
    { icon: "file-text", title: s.buyer2Title, body: s.buyer2Body },
    { icon: "clipboard", title: s.buyer3Title, body: s.buyer3Body },
    { icon: "package", title: s.buyer4Title, body: s.buyer4Body },
    { icon: "truck", title: s.buyer5Title, body: s.buyer5Body },
    { icon: "tag", title: s.buyer6Title, body: s.buyer6Body },
  ];
  const supplier: Array<{ icon: GlyphName; title: string; body: string }> = [
    { icon: "globe", title: s.supplier1Title, body: s.supplier1Body },
    { icon: "building", title: s.supplier2Title, body: s.supplier2Body },
    { icon: "message", title: s.supplier3Title, body: s.supplier3Body },
    { icon: "chart", title: s.supplier4Title, body: s.supplier4Body },
    { icon: "file-text", title: s.supplier5Title, body: s.supplier5Body },
    { icon: "layers", title: s.supplier6Title, body: s.supplier6Body },
  ];
  const arranged: Array<{ icon: GlyphName; title: string; body: string }> = [
    { icon: "shield", title: s.arranged1Title, body: s.arranged1Body },
    { icon: "clipboard", title: s.arranged2Title, body: s.arranged2Body },
    { icon: "ship", title: s.arranged3Title, body: s.arranged3Body },
    { icon: "lock", title: s.arranged4Title, body: s.arranged4Body },
  ];
  const steps: Array<{ icon: GlyphName; title: string; body: string }> = [
    { icon: "message", title: s.step1Title, body: s.step1Body },
    { icon: "file-text", title: s.step2Title, body: s.step2Body },
    { icon: "credit-card", title: s.step3Title, body: s.step3Body },
    { icon: "link", title: s.step4Title, body: s.step4Body },
    { icon: "ship", title: s.step5Title, body: s.step5Body },
  ];
  const faqs = [
    { q: s.faq1Q, a: s.faq1A },
    { q: s.faq2Q, a: s.faq2A },
    { q: s.faq3Q, a: s.faq3A },
    { q: s.faq4Q, a: s.faq4A },
    { q: s.faq5Q, a: s.faq5A },
    { q: s.faq6Q, a: s.faq6A },
  ];

  return (
    <>
      <PageHero kicker={s.kicker} title={s.title} lead={s.lead} />

      <Section>
        <SectionHeader title={s.buyersTitle} lead={s.buyersLead} />
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {buyer.map((item, i) => (
            <Reveal key={item.title} delay={(i % 3) * 60}>
              <FeatureCard icon={item.icon} title={item.title} body={item.body} />
            </Reveal>
          ))}
        </div>
        <Reveal delay={120} className="mt-4">
          <DisclosureNote title={s.arrangedTitle} icon="shield">
            <p>{s.buyerNote}</p>
          </DisclosureNote>
        </Reveal>
      </Section>

      <Section mesh>
        <SectionHeader title={s.suppliersTitle} lead={s.suppliersLead} />
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {supplier.map((item, i) => (
            <Reveal key={item.title} delay={(i % 3) * 60}>
              <FeatureCard icon={item.icon} title={item.title} body={item.body} tone="neutral" />
            </Reveal>
          ))}
        </div>
      </Section>

      <Section>
        {/*
          Inspection/audit/verification are described as services we COORDINATE,
          never as things already performed — the capability flags are all off.
        */}
        <SectionHeader title={s.arrangedTitle} lead={s.arrangedLead} />
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {arranged.map((item, i) => (
            <Reveal key={item.title} delay={i * 60}>
              <FeatureCard icon={item.icon} title={item.title} body={item.body} />
            </Reveal>
          ))}
        </div>
      </Section>

      <Section mesh>
        <SectionHeader title={s.processTitle} lead={s.processLead} />
        <div className="mt-10 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 60}>
              <StepCard index={i} total={steps.length} icon={step.icon} title={step.title} body={step.body} />
            </Reveal>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeader title={s.faqTitle} />
        <Reveal delay={80} className="mt-8 max-w-3xl">
          <Faq items={faqs} />
        </Reveal>
      </Section>

      <CtaBand title={s.ctaTitle} lead={s.ctaLead}>
        <ButtonLink href={`/${lang}/quote`} size="lg">
          {dict.nav.requestQuote}
        </ButtonLink>
        <ButtonLink href={`/${lang}/suppliers/apply`} variant="secondary" size="lg">
          {dict.home.secondaryCta}
        </ButtonLink>
      </CtaBand>
    </>
  );
}
