import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, LOCALE_TAGS, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { requireTier } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { formatUsd, toCents } from "@/lib/money";
import { MAX_TOPUP_CENTS, MIN_TOPUP_CENTS, pageParamSchema } from "@/lib/validation";
import { getDefaultCard } from "@/lib/billing";
import type { WalletTxnKind } from "@/lib/db-types";
import { TopUpForm } from "@/components/dashboard/top-up-form";
import { Reveal } from "@/components/ui/reveal";
import { Pager } from "@/components/ui/pager";

export const metadata: Metadata = { title: "Wallet" };

const PAGE_SIZE = 40;

/** Ledger kind -> dictionary key. Exhaustive by construction. */
const KIND_KEY = {
  topup: "kindTopup",
  charge: "kindCharge",
  refund: "kindRefund",
  adjustment: "kindAdjustment",
  credit_draw: "kindCreditDraw",
  credit_repay: "kindCreditRepay",
} as const satisfies Record<WalletTxnKind, string>;

export default async function WalletPage({
  params,
  searchParams,
}: PageProps<"/[lang]/dashboard/wallet">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const { account, privileges } = await requireTier(lang, "merchant");

  const page = pageParamSchema.parse(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const offset = (page - 1) * PAGE_SIZE;

  const service = supabaseService();
  const { data: ledger, count } = await service
    .from("wallet_transactions")
    .select("id, kind, amount, balance_after, note, created_at", { count: "exact" })
    .eq("account_id", account.user_id)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  const ledgerTotal = count ?? ledger?.length ?? 0;

  const defaultCard = await getDefaultCard(account.user_id);

  const balanceCents = toCents(String(account.wallet_balance));
  const limitCents = toCents(String(account.credit_limit));
  const usedCents = toCents(String(account.credit_used));

  const fmtDateTime = (iso: string) =>
    new Intl.DateTimeFormat(LOCALE_TAGS[lang as Locale], {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <p className="text-sm text-ink-400">{dict.dashboard.walletLead}</p>
      </Reveal>

      <Reveal delay={60}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="panel p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              {dict.dashboard.walletBalance}
            </p>
            <p className="mt-3 font-mono text-4xl font-semibold text-settled-400">
              {formatUsd(balanceCents)}
            </p>
          </div>
          <div className="panel p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              {dict.dashboard.creditAvailable}
            </p>
            {privileges.creditLimitCents > 0 ? (
              <>
                <p className="mt-3 font-mono text-4xl font-semibold text-ink-100">
                  {formatUsd(Math.max(0, limitCents - usedCents))}
                </p>
                <p className="mt-2 text-xs text-ink-500">
                  {dict.dashboard.creditUsed
                    .replace("{used}", formatUsd(usedCents))
                    .replace("{limit}", formatUsd(limitCents))}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-ink-500">{dict.dashboard.noCredit}</p>
            )}
          </div>
        </div>
      </Reveal>

      <Reveal delay={110}>
        <section className="panel p-6" aria-labelledby="topup-heading">
          <h2 id="topup-heading" className="font-bold text-ink-50">
            {dict.dashboard.topUpTitle}
          </h2>
          <div className="mt-4 max-w-sm">
            <TopUpForm
              lang={lang}
              cardLabel={defaultCard ? `VISA •••• ${defaultCard.last4}` : null}
              dict={{
                amount: dict.dashboard.topUpAmount,
                hint: dict.dashboard.topUpHint
                  .replace("{min}", formatUsd(MIN_TOPUP_CENTS))
                  .replace("{max}", formatUsd(MAX_TOPUP_CENTS)),
                cta: dict.dashboard.topUpCta,
                pending: dict.dashboard.topUpPending,
                success: dict.dashboard.topUpSuccess,
                chargedTo: dict.dashboard.chargedTo,
                noCard: dict.dashboard.noCardOnFile,
              }}
            />
          </div>
        </section>
      </Reveal>

      <Reveal delay={160}>
        <section className="panel overflow-hidden" aria-labelledby="ledger-heading">
          <div className="border-b border-white/8 px-5 py-4">
            <h2 id="ledger-heading" className="font-bold text-ink-50">
              {dict.dashboard.ledger}
            </h2>
          </div>

          {ledger && ledger.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-left">
                    <th scope="col" className="px-5 py-3 font-semibold text-ink-500">
                      {dict.common.date}
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold text-ink-500">
                      {dict.common.status}
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold text-ink-500">
                      {dict.common.amount}
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold text-ink-500">
                      {dict.dashboard.balanceAfter}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((t) => {
                    const amountCents = toCents(String(t.amount));
                    const credit = amountCents >= 0;
                    return (
                      <tr key={t.id as string} className="border-b border-white/5 last:border-0">
                        <td className="whitespace-nowrap px-5 py-3.5 text-xs text-ink-500">
                          {fmtDateTime(t.created_at as string)}
                        </td>
                        <td className="px-5 py-3.5 text-ink-300">
                          {dict.dashboard[KIND_KEY[t.kind as WalletTxnKind]]}
                          {t.note ? (
                            <span className="ml-2 text-xs text-ink-600">{t.note as string}</span>
                          ) : null}
                        </td>
                        <td
                          className={
                            credit
                              ? "px-5 py-3.5 text-right font-mono tabular-nums text-settled-400"
                              : "px-5 py-3.5 text-right font-mono tabular-nums text-ink-300"
                          }
                        >
                          {credit ? "+" : ""}
                          {formatUsd(amountCents)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono tabular-nums text-ink-400">
                          {formatUsd(toCents(String(t.balance_after)))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-ink-400">{dict.dashboard.noLedger}</p>
          )}
          <Pager
            basePath={`/${lang}/dashboard/wallet`}
            page={page}
            pageSize={PAGE_SIZE}
            total={ledgerTotal}
            labels={{
              range: dict.common.pagerRange,
              previous: dict.common.pagerPrev,
              next: dict.common.pagerNext,
            }}
          />
        </section>
      </Reveal>
    </div>
  );
}
