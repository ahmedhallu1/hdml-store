import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, LOCALE_TAGS, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { requireTier } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { formatUsd, toCents, sumCents } from "@/lib/money";
import { getCards } from "@/lib/billing";
import { pageParamSchema } from "@/lib/validation";
import { CardManager } from "@/components/dashboard/card-manager";
import { Reveal } from "@/components/ui/reveal";
import { Pager } from "@/components/ui/pager";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Billing" };

type PaymentStatus = "paid" | "pending" | "failed" | "refunded";
type Purpose = "order" | "wallet_topup" | "subscription";

const PAGE_SIZE = 50;

export default async function BillingPage({
  params,
  searchParams,
}: PageProps<"/[lang]/dashboard/billing">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const b = dict.billing;
  const { account } = await requireTier(lang, "merchant");

  const page = pageParamSchema.parse(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const offset = (page - 1) * PAGE_SIZE;

  const service = supabaseService();
  const [cards, { data: payments, count }, { data: totals }] = await Promise.all([
    getCards(account.user_id),
    service
      .from("payments")
      .select("id, provider, purpose, amount, currency, status, created_at, raw", { count: "exact" })
      .eq("account_id", account.user_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),
    // Lifetime rollups. See migration 0009: summing in the app is impossible
    // here because PostgREST caps responses at 1000 rows.
    service.rpc("billing_summary", { p_account: account.user_id }),
  ]);

  const rows = payments ?? [];
  const historyTotal = count ?? rows.length;

  type Rollup = { purpose: string; paid_total: number | string; paid_count: number };
  const rollups = (totals as Rollup[] | null) ?? null;
  const centsFor = (purpose: Purpose | null) => {
    if (rollups) {
      const matched = purpose ? rollups.filter((r) => r.purpose === purpose) : rollups;
      return sumCents(matched.map((r) => toCents(String(r.paid_total))));
    }
    // Fallback for a database that has not run migration 0009 yet: the tiles
    // still render, just over the payments on this page.
    return sumCents(
      rows
        .filter((p) => p.status === "paid" && (!purpose || p.purpose === purpose))
        .map((p) => toCents(String(p.amount))),
    );
  };

  const orderPaid = centsFor("order");
  const topupPaid = centsFor("wallet_topup");
  const subPaid = centsFor("subscription");

  // Deliberately NOT a grand total of the three tiles above: a top-up funds the
  // wallet and the wallet then pays for on-behalf orders, so adding them counts
  // the same money twice. A transaction count is the honest fourth figure.
  const paidCount = rollups
    ? rollups.reduce((sum, r) => sum + Number(r.paid_count), 0)
    : rows.filter((p) => p.status === "paid").length;

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(LOCALE_TAGS[lang as Locale], { dateStyle: "medium" }).format(new Date(iso));

  const purposeLabel: Record<Purpose, string> = {
    order: b.purposeOrder,
    wallet_topup: b.purposeTopup,
    subscription: b.purposeSubscription,
  };
  const statusLabel: Record<PaymentStatus, string> = {
    paid: b.statusPaid,
    pending: b.statusPending,
    failed: b.statusFailed,
    refunded: b.statusRefunded,
  };
  const statusTone: Record<PaymentStatus, "settled" | "verify" | "danger" | "neutral"> = {
    paid: "settled",
    pending: "verify",
    failed: "danger",
    refunded: "neutral",
  };

  const methodLabel = (p: (typeof rows)[number]) => {
    if (p.provider === "wallet") return b.methodWallet;
    const last4 = (p.raw as { last4?: string } | null)?.last4;
    return last4 ? `VISA •••• ${last4}` : b.methodVisa;
  };

  const summary = [
    { label: b.summaryOrders, value: formatUsd(orderPaid), icon: "package" as const, tone: "text-ink-100" },
    { label: b.summaryTopups, value: formatUsd(topupPaid), icon: "wallet" as const, tone: "text-settled-400" },
    { label: b.summarySubs, value: formatUsd(subPaid), icon: "spark" as const, tone: "text-accent-300" },
    {
      label: b.summaryTransactions,
      value: paidCount.toLocaleString(LOCALE_TAGS[lang as Locale]),
      icon: "receipt" as const,
      tone: "text-ink-200",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <p className="text-sm text-ink-400">{b.lead}</p>
      </Reveal>

      <Reveal delay={50}>
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map((s) => (
            <div key={s.label} className="panel p-5">
              <div className="flex items-center justify-between">
                <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">{s.label}</dt>
                <Icon name={s.icon} className="size-4 text-ink-600" />
              </div>
              <dd className={`mt-3 font-mono text-2xl font-semibold ${s.tone}`}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </Reveal>

      <Reveal delay={100}>
        <CardManager
          lang={lang}
          cards={cards}
          dict={{
            cardsTitle: b.cardsTitle,
            addCard: b.addCard,
            cardHolder: b.cardHolder,
            cardNumber: b.cardNumber,
            cardExpiry: b.cardExpiry,
            cardCvc: b.cardCvc,
            saveCard: b.saveCard,
            saving: b.saving,
            cardAdded: b.cardAdded,
            default: b.default,
            makeDefault: b.makeDefault,
            remove: b.remove,
            noCards: b.noCards,
            expires: b.expires,
            addedOn: b.addedOn,
          }}
        />
      </Reveal>

      <Reveal delay={150}>
        <section className="panel overflow-hidden" aria-labelledby="history-heading">
          <div className="border-b border-white/8 px-5 py-4">
            <h2 id="history-heading" className="font-bold text-ink-50">
              {b.historyTitle}
            </h2>
          </div>
          {rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-left">
                    <th scope="col" className="px-5 py-3 font-semibold text-ink-500">{b.colDate}</th>
                    <th scope="col" className="px-5 py-3 font-semibold text-ink-500">{b.colDescription}</th>
                    <th scope="col" className="px-5 py-3 font-semibold text-ink-500">{b.colMethod}</th>
                    <th scope="col" className="px-5 py-3 font-semibold text-ink-500">{b.colStatus}</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold text-ink-500">{b.colAmount}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id as string} className="border-b border-white/5 last:border-0">
                      <td className="whitespace-nowrap px-5 py-3.5 text-xs text-ink-500">
                        {fmtDate(p.created_at as string)}
                      </td>
                      <td className="px-5 py-3.5 text-ink-200">
                        {purposeLabel[p.purpose as Purpose] ?? p.purpose}
                      </td>
                      <td className="px-5 py-3.5 text-ink-400">{methodLabel(p)}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={statusTone[p.status as PaymentStatus]}>
                          {statusLabel[p.status as PaymentStatus] ?? p.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-ink-200">
                        {formatUsd(toCents(String(p.amount)))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-ink-400">{b.noHistory}</p>
          )}
          <Pager
            basePath={`/${lang}/dashboard/billing`}
            page={page}
            pageSize={PAGE_SIZE}
            total={historyTotal}
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
