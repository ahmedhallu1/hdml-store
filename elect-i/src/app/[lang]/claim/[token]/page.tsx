import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, LOCALE_TAGS } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { loadClaim } from "@/lib/claim";
import { formatUsd } from "@/lib/money";
import { company } from "@/config/company";
import { VerifyGate } from "@/components/claim/verify-gate";
import { MatchPanel } from "@/components/claim/match-panel";
import { RecipientForm } from "@/components/claim/recipient-form";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";

/** Claim links are private and must never be indexed or previewed. */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

const CLAIM_TTL_DAYS = 30;

export default async function ClaimPage({ params }: PageProps<"/[lang]/claim/[token]">) {
  const { lang, token } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const state = await loadClaim(token);

  if (state.kind === "not_found") {
    return <Outcome tone="neutral" icon="package" title={dict.claim.notFoundTitle} body={dict.claim.notFoundBody} />;
  }

  if (state.kind === "expired") {
    return (
      <Outcome
        tone="verify"
        icon="shield"
        title={dict.claim.expiredTitle}
        body={dict.claim.expiredBody.replace("{days}", String(state.ttlDays || CLAIM_TTL_DAYS))}
      />
    );
  }

  if (state.kind === "already_claimed") {
    const claimedDate = new Intl.DateTimeFormat(LOCALE_TAGS[lang], {
      dateStyle: "long",
    }).format(new Date(state.claimedAt));
    return (
      <Outcome
        tone="settled"
        icon="check"
        title={dict.claim.alreadyClaimedTitle}
        body={dict.claim.alreadyClaimedBody.replace("{date}", claimedDate)}
        detail={{ label: dict.claim.successRef, value: state.orderNumber }}
      />
    );
  }

  if (state.kind === "needs_verification") {
    return (
      <div className="relative overflow-hidden">
        <div className="grid-mesh radial-fade absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <VerifyGate
            token={token}
            lang={lang}
            orderNumber={state.orderNumber}
            dict={{
              kicker: dict.claim.kicker,
              title: dict.claim.verifyTitle,
              lead: dict.claim.verifyLead,
              label: dict.claim.verifyLabel,
              placeholder: dict.claim.verifyPlaceholder,
              cta: dict.claim.verifyCta,
              error: dict.claim.verifyError,
              locked: dict.claim.verifyLocked,
              orderLabel: dict.claim.orderLabel,
            }}
          />
        </div>
      </div>
    );
  }

  const { claim } = state;
  const paidBy = claim.merchantName
    ? dict.claim.duePaidBy.replace("{merchant}", claim.merchantName)
    : dict.claim.dueNothing;

  return (
    <div className="relative overflow-hidden">
      <div className="grid-mesh radial-fade absolute inset-0" aria-hidden="true" />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-accent-500/10 blur-[120px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Reveal>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="accent">{dict.claim.kicker}</Badge>
            <span className="font-mono text-sm text-ink-500">{claim.orderNumber}</span>
          </div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {dict.claim.pageTitle}
          </h1>
        </Reveal>

        {/*
          The zero balance is the single most reassuring fact on this page, so
          it leads — before the form, before anything they have to read.
        */}
        <Reveal delay={80} className="mt-8">
          <section
            className="panel overflow-hidden border-settled-500/30"
            aria-labelledby="due-heading"
          >
            <div className="flex flex-wrap items-center justify-between gap-6 p-6 sm:p-7">
              <div>
                <h2
                  id="due-heading"
                  className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500"
                >
                  {dict.claim.dueTitle}
                </h2>
                <p className="mt-2 font-mono text-5xl font-semibold text-settled-400 sm:text-6xl">
                  {formatUsd(claim.amountDueCents)}
                </p>
                <p className="mt-3 flex items-center gap-2 text-sm text-ink-300">
                  <Icon name="check" className="size-4 text-settled-400" />
                  {paidBy}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-ink-600">
                  {dict.claim.matchColThis}
                </p>
                <p className="mt-1.5 font-mono text-lg text-ink-400 line-through decoration-ink-600">
                  {formatUsd(claim.totalCents)}
                </p>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal delay={140} className="mt-4">
          <MatchPanel
            claim={claim}
            dict={{
              title: dict.claim.matchTitle,
              ok: dict.claim.matchOk,
              okBody: dict.claim.matchOkBody,
              fail: dict.claim.matchFail,
              failBody: dict.claim.matchFailBody,
              colItem: dict.claim.matchColItem,
              colQty: dict.claim.matchColQty,
              colOriginal: dict.claim.matchColOriginal,
              colThis: dict.claim.matchColThis,
              noComparison: dict.claim.matchNone,
              noComparisonBody: dict.claim.matchNoneBody,
            }}
          />
        </Reveal>

        {/*
          A digest mismatch means the recipient should not proceed, so the form
          is withheld rather than shown alongside a warning they might skip.
        */}
        {claim.digestComparable && !claim.digestsMatch ? (
          <Reveal delay={180} className="mt-4">
            <div className="panel border-danger-500/40 p-6 text-center">
              <p className="text-sm text-ink-300">{dict.claim.matchFailBody}</p>
              <ButtonLink href={`/${lang}/contact`} variant="secondary" className="mt-4">
                {dict.nav.contact}
              </ButtonLink>
            </div>
          </Reveal>
        ) : (
          <Reveal delay={180} className="mt-4">
            <RecipientForm
              token={token}
              lang={lang}
              draft={claim.draft}
              dict={{
                title: dict.claim.formTitle,
                lead: dict.claim.formLead,
                fullName: dict.claim.fullName,
                email: dict.claim.email,
                phone: dict.claim.phone,
                country: dict.claim.country,
                city: dict.claim.city,
                address1: dict.claim.address1,
                address2: dict.claim.address2,
                postalCode: dict.claim.postalCode,
                taxId: dict.claim.taxId,
                taxIdHint: dict.claim.taxIdHint,
                notes: dict.claim.notes,
                notesHint: dict.claim.notesHint,
                optional: dict.common.optional,
                saved: dict.claim.saved,
                saving: dict.claim.savingDraft,
                submitCta: dict.claim.submitCta,
                submitting: dict.claim.submitting,
                validationError: dict.errors.validation,
              }}
            />
          </Reveal>
        )}

        <Reveal delay={220} className="mt-6">
          <ul className="space-y-2 text-xs leading-relaxed text-ink-500">
            <li className="flex gap-2">
              <Icon name="truck" className="mt-0.5 size-3.5 shrink-0" />
              {dict.claim.leadTimeNote.replace("{min}", "15").replace("{max}", "30")}
            </li>
            <li className="flex gap-2">
              <Icon name="globe" className="mt-0.5 size-3.5 shrink-0" />
              {dict.claim.customsNote}
            </li>
            <li className="flex gap-2">
              <Icon name="shield" className="mt-0.5 size-3.5 shrink-0" />
              {company.operator.disclosure}
            </li>
          </ul>
        </Reveal>
      </div>
    </div>
  );
}

function Outcome({
  tone,
  icon,
  title,
  body,
  detail,
}: {
  tone: "neutral" | "verify" | "settled";
  icon: "package" | "shield" | "check";
  title: string;
  body: string;
  detail?: { label: string; value: string };
}) {
  const toneClass =
    tone === "settled"
      ? "border-settled-500/30 bg-settled-500/10 text-settled-400"
      : tone === "verify"
        ? "border-verify-500/30 bg-verify-500/10 text-verify-300"
        : "border-white/10 bg-white/5 text-ink-400";

  return (
    <div className="relative overflow-hidden">
      <div className="grid-mesh radial-fade absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-md px-4 py-20 text-center sm:px-6 lg:py-28">
        <span className={`inline-flex size-14 items-center justify-center rounded-2xl border ${toneClass}`}>
          <Icon name={icon} className="size-7" />
        </span>
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink-50">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-400">{body}</p>
        {detail ? (
          <p className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
            <span className="text-xs text-ink-500">{detail.label}</span>
            <span className="font-mono text-sm text-ink-200">{detail.value}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
