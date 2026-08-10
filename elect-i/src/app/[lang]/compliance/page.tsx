import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { LegalPage, type LegalContent } from "@/components/marketing/legal";

export const metadata: Metadata = { title: "Compliance Policy" };

/** Last reviewed. Bump when the policy text changes. */
const UPDATED_ISO = "2026-07-01";

export default async function LegalDoc({ params }: PageProps<"/[lang]/compliance">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <LegalPage
      lang={lang}
      title={dict.legal.complianceTitle}
      updatedIso={UPDATED_ISO}
      content={dict.legal.docs.compliance as LegalContent}
      labels={{
        toc: dict.legal.toc,
        lastUpdated: dict.legal.lastUpdated,
        questionsTitle: dict.legal.questionsTitle,
        questionsBody: dict.legal.questionsBody,
        contactCta: dict.legal.contactCta,
        operatorTitle: dict.legal.operatorTitle,
      }}
    />
  );
}
