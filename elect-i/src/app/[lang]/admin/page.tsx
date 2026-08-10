import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, LOCALE_TAGS } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { requireAdmin } from "@/lib/auth";
import { getPricingPublic } from "@/lib/settings";
import { CURRENCIES, enabledCurrencies, formatCurrency } from "@/lib/currency";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Administration" };

/**
 * Platform admin index.
 *
 * `requireAdmin` checks `eig.admin_profiles` and 404s for everyone else, so a
 * signed-in merchant sees the same page a stranger does. Middleware already
 * bounces anonymous visitors off `/[lang]/admin/*` before this renders.
 */
export default async function AdminPage({ params }: PageProps<"/[lang]/admin">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  await requireAdmin(lang);

  const dict = await getDictionary(lang);
  const a = dict.admin;
  const settings = await getPricingPublic();
  const available = enabledCurrencies(settings.currencies);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <Reveal>
        <h1 className="type-h2 text-ink-50">{a.title}</h1>
        <p className="type-lead mt-3 text-ink-400">{a.lead}</p>
      </Reveal>

      <Reveal delay={80}>
        <section className="panel mt-10 p-6" aria-labelledby="currency-heading">
          <h2 id="currency-heading" className="flex items-center gap-2 font-bold text-ink-50">
            <Icon name="globe" className="size-4 text-accent-300" />
            {a.currencyTitle}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-400">{a.currencyLead}</p>

          <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-4 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                {a.defaultCurrency}
              </dt>
              <dd className="mt-1 font-mono text-ink-100">
                {settings.display_currency} · {CURRENCIES[settings.display_currency].name}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                {a.enabled}
              </dt>
              <dd className="mt-1 flex flex-wrap gap-2">
                {available.map((code) => (
                  <span
                    key={code}
                    className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-xs text-ink-200"
                  >
                    {code}{" "}
                    <span className="text-ink-500">
                      {formatCurrency(
                        Math.round(100_00 * settings.currencies[code].rate),
                        code,
                        LOCALE_TAGS[lang],
                      )}
                    </span>
                  </span>
                ))}
              </dd>
            </div>
          </dl>

          <ButtonLink href={`/${lang}/admin/currency`} variant="secondary" size="sm" className="mt-6">
            {a.currencyCta}
          </ButtonLink>
        </section>
      </Reveal>
    </div>
  );
}
