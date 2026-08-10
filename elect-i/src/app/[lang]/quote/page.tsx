import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { tradeTerms } from "@/config/company";
import { resolveDisplayCurrency } from "@/lib/display-currency";
import { CurrencyNote } from "@/components/site/currency-note";
import { PageHero, Section } from "@/components/marketing/section";
import { QuoteForm } from "@/components/marketing/quote-form";
import { Reveal } from "@/components/ui/reveal";
import { Glyph } from "@/components/marketing/glyph";

export const metadata: Metadata = { title: "Request a quotation" };

export default async function QuotePage({ params, searchParams }: PageProps<"/[lang]/quote">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const [sp, dict, display] = await Promise.all([
    searchParams,
    getDictionary(lang),
    resolveDisplayCurrency(lang),
  ]);
  const r = dict.rfq;

  const nextSteps = [r.next1, r.next2, r.next3];

  // Prefill from a product page's "Add to order" / "Request a quote" buttons:
  // /quote?sku=…&name=…&qty=…&intent=order
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const skuParam = one(sp.sku).slice(0, 64);
  const nameParam = one(sp.name).slice(0, 200);
  const qtyParam = one(sp.qty).replace(/[^0-9]/g, "").slice(0, 9);
  const defaultDescription =
    nameParam || skuParam
      ? `${nameParam}${nameParam && skuParam ? " — " : ""}${skuParam ? `SKU ${skuParam}` : ""}`
      : "";

  return (
    <>
      <PageHero kicker={r.kicker} title={r.title} lead={r.lead} />

      <Section className="!pt-4">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
          <Reveal>
            <div className="panel p-6 sm:p-8">
              <QuoteForm
                lang={lang}
                tradeTerms={tradeTerms}
                defaultDescription={defaultDescription}
                defaultQty={qtyParam}
                dict={{
                  itemsTitle: r.itemsTitle,
                  productDescription: r.productDescription,
                  itemsLead: r.itemsLead,
                  itemPlaceholder: r.itemPlaceholder,
                  qty: r.qty,
                  logisticsTitle: r.logisticsTitle,
                  destination: r.destination,
                  destinationHint: r.destinationHint,
                  incoterm: r.incoterm,
                  noPreference: r.noPreference,
                  targetPrice: r.targetPrice,
                  targetPriceHint: r.targetPriceHint,
                  targetPricePlaceholder: r.targetPricePlaceholder,
                  contactTitle: r.contactTitle,
                  yourName: r.yourName,
                  workEmail: r.workEmail,
                  phone: r.phone,
                  companyName: r.companyName,
                  optional: dict.common.optional,
                  submitCta: r.submitCta,
                  sending: r.sending,
                  successTitle: r.successTitle,
                  errorTitle: r.errorTitle,
                  referenceLabel: r.referenceLabel,
                }}
              />
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="lg:sticky lg:top-24">
              <h2 className="text-lg font-bold text-ink-50">{r.whatNextTitle}</h2>
              <ol className="mt-5 space-y-4">
                {nextSteps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-accent-400/25 bg-accent-500/10 font-mono text-xs font-semibold text-accent-300">
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-ink-400">{step}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-6 flex gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <Glyph name="scale" className="mt-0.5 size-4 shrink-0 text-ink-500" />
                <p className="text-xs leading-relaxed text-ink-500">{r.incotermNote}</p>
              </div>
              {/*
                The target-price field is quoted in USD like every quotation we
                return, so a visitor browsing in another currency is told which
                unit the number they type is read in.
              */}
              <CurrencyNote display={display} dict={dict} className="mt-4" />
            </div>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
