import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import {
  PageHero,
  Section,
  SectionHeader,
  FeatureCard,
  DisclosureNote,
} from "@/components/marketing/section";
import { SupplierForm } from "@/components/marketing/supplier-form";
import { Reveal } from "@/components/ui/reveal";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Become a supplier" };

export default async function SupplierApplyPage({ params }: PageProps<"/[lang]/suppliers/apply">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const s = dict.suppliersApply;

  const requirements = [s.req1, s.req2, s.req3, s.req4, s.req5, s.req6];
  const levels = [
    { title: s.level1Title, body: s.level1Body },
    { title: s.level2Title, body: s.level2Body },
    { title: s.level3Title, body: s.level3Body },
    { title: s.level4Title, body: s.level4Body },
  ];

  return (
    <>
      <PageHero kicker={s.kicker} title={s.title} lead={s.lead} />

      <Section className="!pt-4">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-14">
          <Reveal>
            <div className="panel p-6 sm:p-8">
              <h2 className="text-lg font-bold text-ink-50">{s.formTitle}</h2>
              <div className="mt-6">
                <SupplierForm
                  lang={lang}
                  dict={{
                    companyName: s.companyName,
                    contactName: s.contactName,
                    email: s.email,
                    country: s.country,
                    website: s.website,
                    websiteOptional: s.websiteOptional,
                    productCategories: s.productCategories,
                    productCategoriesHint: s.productCategoriesHint,
                    message: s.message,
                    messageOptional: s.messageOptional,
                    submitCta: s.submitCta,
                    sending: s.sending,
                    successTitle: s.successTitle,
                    errorTitle: s.errorTitle,
                    referenceLabel: dict.rfq.referenceLabel,
                  }}
                />
              </div>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="lg:sticky lg:top-24">
              <h2 className="text-lg font-bold text-ink-50">{s.requirementsTitle}</h2>
              <ul className="mt-4 space-y-2.5">
                {requirements.map((req) => (
                  <li key={req} className="flex items-start gap-2.5 text-sm text-ink-400">
                    <Icon name="check" className="mt-0.5 size-4 shrink-0 text-accent-400" />
                    {req}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {/* The honest disclosure that levels reflect documents, not audits. */}
                <DisclosureNote title={s.levelsTitle} icon="shield">
                  <p>{s.requirementsLead}</p>
                </DisclosureNote>
              </div>
            </div>
          </Reveal>
        </div>
      </Section>

      <Section mesh>
        <SectionHeader title={s.levelsTitle} />
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {levels.map((level, i) => (
            <Reveal key={level.title} delay={i * 60}>
              <FeatureCard icon="shield" title={level.title} body={level.body} tone="neutral" />
            </Reveal>
          ))}
        </div>
      </Section>
    </>
  );
}
