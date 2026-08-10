import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import { company, hasLegalEntity, hasOffice } from "@/config/company";
import { resolveDisplayCurrency } from "@/lib/display-currency";
import { Logo } from "./logo";
import { LocalClock } from "./local-clock";
import { CurrencySwitcher } from "./currency-switcher";
import { Icon } from "@/components/ui/icon";

export async function SiteFooter({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const display = await resolveDisplayCurrency(lang);
  const columns = [
    {
      title: dict.footer.marketplace,
      links: [
        { href: `/${lang}/catalog`, label: dict.nav.catalog },
        { href: `/${lang}/categories`, label: dict.nav.categories },
        { href: `/${lang}/suppliers`, label: dict.nav.suppliers },
        { href: `/${lang}/membership`, label: dict.nav.pricing },
        { href: `/${lang}/quote`, label: dict.nav.requestQuote },
      ],
    },
    {
      title: dict.footer.company,
      links: [
        { href: `/${lang}/about`, label: dict.nav.about },
        { href: `/${lang}/services`, label: dict.nav.services },
        { href: `/${lang}/contact`, label: dict.nav.contact },
        { href: `/${lang}/developers`, label: dict.nav.developers },
      ],
    },
    {
      title: dict.footer.support,
      links: [
        { href: `/${lang}/shipping`, label: dict.footer.shipping },
        { href: `/${lang}/payments`, label: dict.footer.payments },
        { href: `/${lang}/returns`, label: dict.footer.returns },
      ],
    },
    {
      title: dict.footer.legal,
      links: [
        { href: `/${lang}/terms`, label: dict.footer.terms },
        { href: `/${lang}/privacy`, label: dict.footer.privacy },
        { href: `/${lang}/compliance`, label: dict.footer.compliance },
        { href: `/${lang}/intellectual-property`, label: dict.footer.ip },
      ],
    },
  ];

  // Extract the IANA zone from "Africa/Cairo (UTC+2)" for the live clock.
  const timeZone = company.businessHours.timezone.split(" ")[0];

  return (
    <footer className="grain relative overflow-hidden border-t border-white/8 bg-obsidian-950">
      <div
        className="grid-mesh pointer-events-none absolute inset-0 opacity-50"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 left-1/2 h-80 w-[52rem] -translate-x-1/2 rounded-full bg-accent-500/[0.07] blur-[120px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-8">
        {/* ── Masthead ────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-8 py-14 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-lg">
            <Logo />
            <p className="mt-5 type-lead text-ink-400">{dict.footer.tagline}</p>
          </div>
          <p className="type-eyebrow shrink-0 text-accent-400/80 lg:text-right">
            {company.slogan}
          </p>
        </div>

        <div className="rule-fade h-px" aria-hidden="true" />

        {/* ── Link columns ────────────────────────────────────────────── */}
        <div className="grid gap-x-8 gap-y-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((col) => (
            <div key={col.title}>
              <h2 className="type-eyebrow text-ink-500">{col.title}</h2>
              <ul className="mt-5 space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-1.5 text-sm text-ink-400 transition-colors duration-200 hover:text-accent-200"
                    >
                      <span
                        aria-hidden="true"
                        className="h-px w-0 bg-accent-400 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:w-3"
                      />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="rule-fade h-px" aria-hidden="true" />

        {/* ── Operations strip ────────────────────────────────────────── */}
        <div className="grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <h2 className="type-eyebrow text-ink-500">{dict.nav.contact}</h2>
            <ul className="mt-4 space-y-2 text-sm text-ink-400">
              <li>
                <a
                  href={`mailto:${company.contact.email}`}
                  className="inline-flex items-center gap-2 transition-colors hover:text-accent-200"
                >
                  <Icon name="link" className="size-3.5 text-ink-600" />
                  {company.contact.email}
                </a>
              </li>
              <li>
                <Link
                  href={`/${lang}/contact`}
                  className="inline-flex items-center gap-2 transition-colors hover:text-accent-200"
                >
                  <Icon name="globe" className="size-3.5 text-ink-600" />
                  {dict.nav.contact}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="type-eyebrow text-ink-500">{dict.footer.businessHours}</h2>
            <ul className="mt-4 space-y-2 text-sm text-ink-400">
              <li>{company.businessHours.weekdays}</li>
              <li>{company.businessHours.saturday}</li>
              <li className="flex items-center gap-2 font-mono text-xs text-ink-500">
                {company.businessHours.timezone}
                <LocalClock timeZone={timeZone} className="text-settled-400" />
              </li>
            </ul>
          </div>

          {/*
            Registered-entity details render only once real ones exist in
            config/company.ts. Nothing here is ever a placeholder.
          */}
          {hasLegalEntity || hasOffice ? (
            <div>
              <h2 className="type-eyebrow text-ink-500">{dict.footer.legal}</h2>
              <address className="mt-4 space-y-1 text-sm not-italic text-ink-400">
                {hasLegalEntity ? <div>{company.legalEntity.registeredName}</div> : null}
                {company.legalEntity.registrationNumber ? (
                  <div className="font-mono text-xs">{company.legalEntity.registrationNumber}</div>
                ) : null}
                {hasOffice ? (
                  <>
                    <div>{company.office.line1}</div>
                    <div>
                      {company.office.city} {company.office.postalCode}
                    </div>
                    <div>{company.office.country}</div>
                  </>
                ) : null}
              </address>
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-4 border-t border-white/8 py-8 text-xs text-ink-600">
          <p>
            © {new Date().getFullYear()} {company.name}. {dict.footer.rights}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {/*
              The picker reads the current query string so a filtered catalogue
              survives a currency change; that makes it a dynamic client hook,
              which needs its own boundary here in the shared layout.
            */}
            <Suspense fallback={null}>
              <CurrencySwitcher
                current={display.code}
                available={display.available}
                label={dict.common.currency}
                apply={dict.common.applyCurrency}
              />
            </Suspense>
            <p className="font-mono tracking-wider">{company.domain}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
