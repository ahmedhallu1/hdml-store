import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, LOCALE_TAGS, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { requireTier } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { toCents } from "@/lib/money";
import { formatDisplayAmount } from "@/lib/currency";
import { resolveDisplayCurrency } from "@/lib/display-currency";
import { onBehalfCountThisMonth } from "@/lib/orders";
import type { OrderStatus } from "@/lib/db-types";
import { Reveal } from "@/components/ui/reveal";
import { Counter } from "@/components/ui/counter";
import { Icon, type IconName } from "@/components/ui/icon";
import { ButtonLink } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ params }: PageProps<"/[lang]/dashboard">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // Dashboard money is stored in USD but shown in the account's display
  // currency (EGP by default); the picker switches it back. Ledger figures use
  // the exact formatter — a balance is never rounded to a retail step.
  const display = await resolveDisplayCurrency(lang);
  const formatUsd = (cents: number) => formatDisplayAmount(cents, display);
  const dict = await getDictionary(lang);
  const { account, privileges } = await requireTier(lang, "merchant");

  const service = supabaseService();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [ordersThisMonth, awaiting, confirmed, recent, usedThisMonth] = await Promise.all([
    service
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("merchant_account_id", account.user_id)
      .gte("created_at", monthStart.toISOString()),
    service
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("merchant_account_id", account.user_id)
      .eq("status", "awaiting_recipient"),
    service
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("merchant_account_id", account.user_id)
      .not("claimed_at", "is", null),
    service
      .from("orders")
      .select("id, order_number, status, total, created_at")
      .eq("merchant_account_id", account.user_id)
      .order("created_at", { ascending: false })
      .limit(6),
    onBehalfCountThisMonth(account.user_id),
  ]);

  const balanceCents = toCents(String(account.wallet_balance));
  const creditAvailableCents =
    toCents(String(account.credit_limit)) - toCents(String(account.credit_used));

  const stats: Array<{ label: string; value: React.ReactNode; icon: IconName; tone: string }> = [
    {
      label: dict.dashboard.walletBalance,
      value: formatUsd(balanceCents),
      icon: "wallet",
      tone: "text-settled-400",
    },
    {
      label: dict.dashboard.creditAvailable,
      value: privileges.creditLimitCents > 0 ? formatUsd(Math.max(0, creditAvailableCents)) : "—",
      icon: "shield",
      tone: "text-ink-200",
    },
    {
      label: dict.dashboard.claimsPending,
      value: <Counter to={awaiting.count ?? 0} />,
      icon: "link",
      tone: "text-accent-300",
    },
    {
      label: dict.dashboard.claimsClaimed,
      value: <Counter to={confirmed.count ?? 0} />,
      icon: "check",
      tone: "text-settled-400",
    },
  ];

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(LOCALE_TAGS[lang as Locale], { dateStyle: "medium" }).format(
      new Date(iso),
    );

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <p className="text-sm text-ink-400">{dict.dashboard.overviewLead}</p>
      </Reveal>

      <Reveal delay={60}>
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="panel p-5">
              <div className="flex items-center justify-between">
                <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                  {stat.label}
                </dt>
                <Icon name={stat.icon} className="size-4 text-ink-600" />
              </div>
              <dd className={`mt-3 font-mono text-2xl font-semibold ${stat.tone}`}>{stat.value}</dd>
            </div>
          ))}
        </dl>
      </Reveal>

      <Reveal delay={110}>
        <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-xl border border-accent-400/25 bg-accent-500/10 text-accent-300">
              <Icon name="link" className="size-5" />
            </span>
            <div>
              <p className="font-semibold text-ink-100">{dict.dashboard.newOnBehalf}</p>
              <p className="mt-0.5 text-xs text-ink-500">
                {privileges.onBehalfOrdersPerMonth === null
                  ? dict.tiers.unlimited
                  : dict.dashboard.remainingThisMonth
                      .replace("{used}", String(usedThisMonth))
                      .replace("{limit}", String(privileges.onBehalfOrdersPerMonth))}
              </p>
            </div>
          </div>
          <ButtonLink href={`/${lang}/dashboard/on-behalf`} size="sm">
            {dict.dashboard.onBehalf}
            <Icon name="arrow-right" className="size-4" />
          </ButtonLink>
        </div>
      </Reveal>

      <Reveal delay={160}>
        <section className="panel overflow-hidden" aria-labelledby="activity-heading">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
            <h2 id="activity-heading" className="font-bold text-ink-50">
              {dict.dashboard.recentActivity}
            </h2>
            <span className="font-mono text-xs text-ink-600">
              {dict.dashboard.ordersThisMonth}: {ordersThisMonth.count ?? 0}
            </span>
          </div>

          {recent.data && recent.data.length > 0 ? (
            <ul className="divide-y divide-white/5">
              {recent.data.map((o) => (
                <li
                  key={o.id as string}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="font-mono text-xs text-ink-300">
                      {o.order_number as string}
                    </span>
                    <OrderStatusBadge
                      status={o.status as OrderStatus}
                      label={dict.orderStatus[o.status as OrderStatus]}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-ink-600">{fmtDate(o.created_at as string)}</span>
                    <span className="font-mono text-sm tabular-nums text-ink-200">
                      {formatUsd(toCents(String(o.total)))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-ink-400">
              {dict.dashboard.noActivity}
            </p>
          )}
        </section>
      </Reveal>
    </div>
  );
}
