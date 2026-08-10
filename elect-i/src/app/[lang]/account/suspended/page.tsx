import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { AuthOutcome } from "@/components/auth/auth-shell";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Account on hold", robots: { index: false } };

export default async function SuspendedPage({ params }: PageProps<"/[lang]/account/suspended">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <AuthOutcome
      icon="shield"
      title={dict.account.suspendedTitle}
      body={dict.account.suspendedBody}
      action={
        <ButtonLink href={`/${lang}/contact`} variant="secondary">
          {dict.account.contactCta}
        </ButtonLink>
      }
    />
  );
}
