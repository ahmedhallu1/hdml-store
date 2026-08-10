import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import { getAccount } from "@/lib/auth";
import { atLeast } from "@/lib/tiers";
import { Logo } from "./logo";
import { LanguageSwitcher } from "./language-switcher";
import { MobileMenu } from "./mobile-menu";
import { HeaderShell } from "./header-shell";
import { HeaderSearch } from "./header-search";
import { NavLink } from "./nav-link";
import { ButtonLink } from "@/components/ui/button";
import { Magnetic } from "@/components/ui/magnetic";

export async function SiteHeader({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const account = await getAccount();
  const isMerchant = account ? atLeast(account.tier, "merchant") : false;

  const links = [
    { href: `/${lang}/catalog`, label: dict.nav.catalog },
    { href: `/${lang}/categories`, label: dict.nav.categories },
    { href: `/${lang}/suppliers`, label: dict.nav.suppliers },
    { href: `/${lang}/membership`, label: dict.nav.pricing },
    { href: `/${lang}/developers`, label: dict.nav.developers },
    { href: `/${lang}/about`, label: dict.nav.about },
  ];

  return (
    <HeaderShell>
      <Link
        href={`/${lang}`}
        className="group shrink-0 rounded-lg"
        aria-label={dict.common.brand}
      >
        <Logo className="transition-opacity duration-200 group-hover:opacity-85" />
      </Link>

      <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
        {links.map((link) => (
          <NavLink key={link.href} href={link.href} label={link.label} />
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <HeaderSearch lang={lang} label={dict.common.search} />

        <div className="hidden xl:block">
          <LanguageSwitcher lang={lang} label={dict.nav.language} />
        </div>

        {/*
          Responsive visibility lives on plain wrapper spans, never directly on
          the buttons: Button/ButtonLink bake in `inline-flex`, and a `hidden`
          on the same element loses the display cascade to it (so the button
          would stay visible on mobile). A wrapper has no competing base.
        */}
        {account ? (
          <>
            {isMerchant ? (
              <span className="hidden sm:inline-flex">
                <ButtonLink href={`/${lang}/dashboard`} variant="secondary" size="sm">
                  {dict.nav.dashboard}
                </ButtonLink>
              </span>
            ) : null}
            <span className="hidden sm:inline-flex">
              <ButtonLink href={`/${lang}/account`} variant="ghost" size="sm">
                {dict.nav.account}
              </ButtonLink>
            </span>
          </>
        ) : (
          <span className="hidden sm:inline-flex">
            <ButtonLink href={`/${lang}/login`} variant="ghost" size="sm">
              {dict.nav.signIn}
            </ButtonLink>
          </span>
        )}

        <span className="hidden md:inline-flex">
          <Magnetic strength={5} radius={28}>
            <ButtonLink href={`/${lang}/catalog`} size="sm">
              {dict.nav.startSourcing}
            </ButtonLink>
          </Magnetic>
        </span>

        <MobileMenu
          lang={lang}
          links={links}
          dict={{
            menu: dict.nav.menu,
            close: dict.common.close,
            signIn: dict.nav.signIn,
            account: dict.nav.account,
            dashboard: dict.nav.dashboard,
            startSourcing: dict.nav.startSourcing,
            language: dict.nav.language,
            search: dict.common.search,
          }}
          signedIn={Boolean(account)}
          isMerchant={isMerchant}
        />
      </div>
    </HeaderShell>
  );
}
