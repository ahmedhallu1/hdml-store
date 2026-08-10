import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { company } from "@/config/company";
import { PageHero, Section } from "@/components/marketing/section";
import { ContactForm } from "@/components/marketing/contact-form";
import { Reveal } from "@/components/ui/reveal";
import { Glyph } from "@/components/marketing/glyph";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage({ params }: PageProps<"/[lang]/contact">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const c = dict.contact;

  // Real, monitored routes only — every address below is provisioned in
  // Cloudflare Email Routing. Contact is email-only; no phone line is published.
  const zh = lang === "zh";
  const deptLabel: Record<string, string> = {
    general: zh ? "一般咨询" : "General",
    sales: zh ? "订单" : "Orders",
    support: zh ? "支持" : "Support",
    billing: zh ? "账单" : "Billing",
  };
  const direct = company.contact.departments.map((d) => ({
    icon: "mail" as const,
    label: deptLabel[d.key] ?? c.emailLabel,
    value: d.address,
    href: `mailto:${d.address}`,
  }));

  return (
    <>
      <PageHero kicker={c.kicker} title={c.title} lead={c.lead} />

      <Section className="!pt-4">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-14">
          <Reveal>
            <div className="panel p-6 sm:p-8">
              <h2 className="text-lg font-bold text-ink-50">{c.formTitle}</h2>
              <p className="mt-1.5 text-sm text-ink-400">{c.formLead}</p>
              <div className="mt-6">
                <ContactForm
                  lang={lang}
                  dict={{
                    name: c.name,
                    email: c.email,
                    subject: c.subject,
                    message: c.message,
                    messageHint: c.messageHint,
                    sendCta: c.sendCta,
                    sending: c.sending,
                    successTitle: c.successTitle,
                    errorTitle: c.errorTitle,
                  }}
                />
              </div>
              <p className="mt-4 text-xs text-ink-600">{c.privacyNote}</p>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="flex flex-col gap-6 lg:sticky lg:top-24">
              <div>
                <h2 className="text-lg font-bold text-ink-50">{c.directTitle}</h2>
                <ul className="mt-4 space-y-3">
                  {direct.map((item) => (
                    <li key={item.label}>
                      <a
                        href={item.href}
                        className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4 transition-colors hover:border-accent-400/30"
                      >
                        <span className="inline-flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-ink-300">
                          <Glyph name={item.icon} className="size-4" />
                        </span>
                        <span>
                          <span className="block text-xs text-ink-500">{item.label}</span>
                          <span className="text-sm text-ink-100">{item.value}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="text-lg font-bold text-ink-50">{c.hoursTitle}</h2>
                <ul className="mt-4 space-y-1.5 text-sm text-ink-400">
                  <li>{company.businessHours.weekdays}</li>
                  <li>{company.businessHours.saturday}</li>
                  <li className="font-mono text-xs text-ink-500">{company.businessHours.timezone}</li>
                </ul>
              </div>

              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-sm font-semibold text-ink-100">{c.responseTitle}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-500">{c.responseBody}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
