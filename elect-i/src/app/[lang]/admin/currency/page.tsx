import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, LOCALE_TAGS } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { requireAdmin } from "@/lib/auth";
import { getPricingPublic } from "@/lib/settings";
import { CurrencyForm } from "@/components/admin/currency-form";
import { Reveal } from "@/components/ui/reveal";

export const metadata: Metadata = { title: "Display currencies" };

/**
 * Editor for the rates browsing prices are converted at.
 *
 * Same gate as every other admin surface: `requireAdmin` reads
 * `eig.admin_profiles` and 404s otherwise. The action behind the form repeats
 * the check — a rendered form is not a boundary.
 */
export default async function AdminCurrencyPage({
  params,
}: PageProps<"/[lang]/admin/currency">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireAdmin(lang);

  const dict = await getDictionary(lang);
  const a = dict.admin;
  const settings = await getPricingPublic();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <Reveal>
        <Link
          href={`/${lang}/admin`}
          className="text-sm text-ink-400 transition-colors hover:text-accent-200"
        >
          ← {a.title}
        </Link>
        <h1 className="type-h2 mt-3 text-ink-50">{a.currencyTitle}</h1>
        <p className="type-lead mt-3 text-ink-400">{a.currencyLead}</p>
      </Reveal>

      <Reveal delay={70}>
        <section className="panel mt-8 p-6" aria-label={a.currencyTitle}>
          <CurrencyForm
            lang={lang}
            locale={LOCALE_TAGS[lang]}
            defaultCurrency={settings.display_currency}
            rates={settings.currencies}
            dict={{
              defaultCurrency: a.defaultCurrency,
              defaultCurrencyHint: a.defaultCurrencyHint,
              rate: a.rate,
              rateHint: a.rateHint,
              enabled: a.enabled,
              baseCurrency: a.baseCurrency,
              preview: a.preview,
              previewHint: a.previewHint,
              save: dict.common.save,
              saving: dict.common.saving,
              saved: a.saved,
            }}
          />
        </section>
      </Reveal>

      <Reveal delay={130}>
        <section className="panel mt-6 p-6" aria-labelledby="resolution-heading">
          <h2 id="resolution-heading" className="font-bold text-ink-50">
            {a.resolutionTitle}
          </h2>
          <ol className="mt-4 flex flex-col gap-2.5 text-sm text-ink-400">
            {[a.resolutionCookie, a.resolutionCountry, a.resolutionDefault, a.resolutionFallback].map(
              (line, index) => (
                <li key={line} className="flex gap-3">
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 font-mono text-xs text-ink-300">
                    {index + 1}
                  </span>
                  <span className="leading-relaxed">{line}</span>
                </li>
              ),
            )}
          </ol>
        </section>
      </Reveal>
    </div>
  );
}
