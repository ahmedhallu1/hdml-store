import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { requireTier } from "@/lib/auth";
import { BrandingForm } from "@/components/dashboard/branding-form";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params }: PageProps<"/[lang]/dashboard/settings">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const { account, privileges } = await requireTier(lang, "merchant");

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <p className="text-sm text-ink-400">{dict.dashboard.settingsLead}</p>
      </Reveal>

      <Reveal delay={60}>
        <section className="panel p-6" aria-labelledby="branding-heading">
          <h2 id="branding-heading" className="font-bold text-ink-50">
            {dict.dashboard.brandingTitle}
          </h2>

          {privileges.coBrandedClaimPage ? (
            <div className="mt-4">
              <BrandingForm
                lang={lang}
                displayName={account.brand_display_name ?? ""}
                logoUrl={account.brand_logo_url ?? ""}
                dict={{
                  displayName: dict.dashboard.displayName,
                  displayNameHint: dict.dashboard.displayNameHint,
                  logoUrl: dict.dashboard.logoUrl,
                  logoUrlHint: dict.dashboard.logoUrlHint,
                  logoPreview: dict.dashboard.logoPreview,
                  save: dict.common.save,
                  saving: dict.common.saving,
                  saved: dict.dashboard.brandingSaved,
                  optional: dict.common.optional,
                }}
              />
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] p-5 text-center">
              <span className="mx-auto inline-flex size-10 items-center justify-center rounded-lg border border-accent-400/25 bg-accent-500/10 text-accent-300">
                <Icon name="spark" className="size-5" />
              </span>
              <p className="mt-3 text-sm text-ink-400">{dict.dashboard.coBrandUpgradeBody}</p>
              <ButtonLink href={`/${lang}/membership?upgrade=elite`} variant="secondary" size="sm" className="mt-4">
                {dict.dashboard.upgradeCta}
              </ButtonLink>
            </div>
          )}
        </section>
      </Reveal>
    </div>
  );
}
