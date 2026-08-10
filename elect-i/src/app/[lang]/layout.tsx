import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { isLocale, LOCALES, LOCALE_TAGS } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { company } from "@/config/company";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Cursor } from "@/components/site/cursor";
import { RouteProgress } from "@/components/site/route-progress";
import "../globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? `https://${company.domain}`),
  title: {
    default: `${company.name} — ${company.oneLine}`,
    template: `%s | ${company.name}`,
  },
  description: company.shortDescription,
  openGraph: {
    type: "website",
    siteName: company.name,
    title: `${company.name} — ${company.slogan}`,
    description: company.shortDescription,
  },
  icons: { icon: "/brand/mark.svg" },
};

/** Pre-render both locale shells; page data still resolves per request. */
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export default async function LangLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <html
      lang={LOCALE_TAGS[lang]}
      className={`${jakarta.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <head>
        {/*
          Entrance states are armed during render and disarmed by JS. Without
          scripting nothing would ever disarm them, so the whole page would be
          invisible — this restores it instead.
        */}
        <noscript>
          <style>{`.reveal.is-armed{opacity:1}.line-mask.is-armed>span{transform:none;opacity:1}`}</style>
        </noscript>
      </head>
      <body className="min-h-full flex flex-col bg-obsidian-900 text-ink-100">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-accent-500 focus:px-4 focus:py-2 focus:font-semibold focus:text-obsidian-950"
        >
          Skip to content
        </a>
        <RouteProgress />
        <SiteHeader lang={lang} dict={dict} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter lang={lang} dict={dict} />
        {/* Decorative, fine-pointer only; mounts nothing on touch devices. */}
        <Cursor />
      </body>
    </html>
  );
}
