import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { LOCALE_TAGS } from "@/i18n/config";
import { company } from "@/config/company";
import { Reveal } from "@/components/ui/reveal";
import { Badge } from "@/components/ui/badge";
import { Glyph } from "./glyph";

/**
 * Shared typography for the seven legal documents.
 *
 * Written by hand rather than pulled from @tailwindcss/typography: the whole
 * design system is dark-first and the plugin's colour assumptions would have
 * to be overridden line by line anyway.
 */

export interface LegalBlock {
  /** A paragraph. */
  p?: string;
  /** A bullet list. */
  ul?: string[];
  /** A term/definition list — used for data categories, incoterms, statuses. */
  dl?: Array<{ t: string; d: string }>;
  /** A boxed emphasis line for the things buyers must not miss. */
  note?: string;
}

export interface LegalSection {
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalContent {
  lead: string;
  sections: LegalSection[];
}

export interface LegalLabels {
  toc: string;
  lastUpdated: string;
  questionsTitle: string;
  questionsBody: string;
  contactCta: string;
  operatorTitle: string;
}

/** Rendered as an explicit date string so it never drifts with the build. */
export function formatLegalDate(iso: string, lang: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[lang], {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function LegalPage({
  lang,
  title,
  updatedIso,
  content,
  labels,
}: {
  lang: Locale;
  title: string;
  updatedIso: string;
  content: LegalContent;
  labels: LegalLabels;
}) {
  return (
    <>
      <section className="relative overflow-hidden border-b border-white/8">
        <div className="grid-mesh radial-fade absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-16 sm:px-6 lg:px-8 lg:pb-16 lg:pt-20">
          <Reveal className="max-w-3xl">
            <Badge tone="accent">
              <Glyph name="scale" className="size-3.5" />
              {company.name}
            </Badge>
            <h1 className="mt-5 text-[2rem] font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {title}
            </h1>
            <p className="mt-5 text-base leading-relaxed text-ink-400 sm:text-lg">
              {content.lead}
            </p>
            <p className="mt-6 font-mono text-xs uppercase tracking-[0.18em] text-ink-400">
              {labels.lastUpdated}: {formatLegalDate(updatedIso, lang)}
            </p>
          </Reveal>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-14">
          {/* Contents — a plain nav on mobile, sticky rail from lg up. */}
          <nav aria-label={labels.toc} className="lg:sticky lg:top-24 lg:self-start">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-ink-400">
              {labels.toc}
            </h2>
            <ol className="mt-4 space-y-1">
              {content.sections.map((section, i) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="flex min-h-9 items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink-400 transition-colors duration-200 hover:bg-white/5 hover:text-accent-200"
                  >
                    <span className="font-mono text-xs text-ink-500">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">{section.heading}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="min-w-0 max-w-3xl">
            {content.sections.map((section, i) => (
              <Reveal key={section.id} as="section" delay={Math.min(i, 6) * 40}>
                <div id={section.id} className="scroll-mt-24 pb-10">
                  <h2 className="flex items-baseline gap-3 text-xl font-bold tracking-tight text-ink-50 sm:text-2xl">
                    <span className="font-mono text-sm font-semibold text-accent-400">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {section.heading}
                  </h2>
                  <div className="mt-4 space-y-4">
                    {section.blocks.map((block, bi) => (
                      <LegalBlockView key={bi} block={block} />
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}

            <div className="panel mt-4 p-6">
              <h2 className="font-bold text-ink-50">{labels.questionsTitle}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-400">{labels.questionsBody}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/${lang}/contact`}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-5 py-2.5 text-sm font-semibold text-ink-100 transition-all duration-200 hover:border-accent-400/40 hover:bg-white/10"
                >
                  {labels.contactCta}
                  <Glyph name="arrow-right" className="size-4" />
                </Link>
                <a
                  href={`mailto:${company.contact.email}`}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-ink-300 transition-colors duration-200 hover:text-accent-200"
                >
                  <Glyph name="mail" className="size-4" />
                  {company.contact.email}
                </a>
              </div>
            </div>

            {/*
              Who the buyer is contracting with. Repeated on every legal page
              because these are the pages people read before paying.
            */}
            <div className="mt-6 rounded-xl border border-white/8 bg-white/[0.02] p-5">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-ink-400">
                {labels.operatorTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-400">
                {company.operator.disclosure}
              </p>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}

function LegalBlockView({ block }: { block: LegalBlock }) {
  if (block.p) {
    return <p className="text-[15px] leading-7 text-ink-400">{block.p}</p>;
  }
  if (block.ul) {
    return (
      <ul className="space-y-2.5">
        {block.ul.map((item) => (
          <li key={item} className="flex gap-3 text-[15px] leading-7 text-ink-400">
            <span
              className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent-400/70"
              aria-hidden="true"
            />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (block.dl) {
    return (
      <dl className="space-y-3">
        {block.dl.map((row) => (
          <div
            key={row.t}
            className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3"
          >
            <dt className="text-sm font-semibold text-ink-100">{row.t}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-ink-400">{row.d}</dd>
          </div>
        ))}
      </dl>
    );
  }
  if (block.note) {
    return (
      <p className="rounded-xl border border-accent-400/25 bg-accent-500/[0.07] px-4 py-3 text-[15px] leading-7 text-ink-300">
        {block.note}
      </p>
    );
  }
  return null;
}
