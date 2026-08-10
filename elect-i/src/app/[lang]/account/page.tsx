import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, LOCALE_TAGS, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { requireAccount } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { formatDisplayAmount } from "@/lib/currency";
import { resolveDisplayCurrency } from "@/lib/display-currency";
import { toCents } from "@/lib/money";
import { atLeast } from "@/lib/tiers";
import type { OrderStatus } from "@/lib/db-types";
import { ProfileForm } from "@/components/account/profile-form";
import { SignOutButton } from "@/components/account/sign-out-button";
import { Reveal } from "@/components/ui/reveal";
import { Icon } from "@/components/ui/icon";
import { ButtonLink } from "@/components/ui/button";
import { OrderStatusBadge, TierBadge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Account" };

const TIER_STATUS_KEY = {
  active: "statusActive",
  past_due: "statusPastDue",
  cancelled: "statusCancelled",
  expired: "statusExpired",
} as const;

export default async function AccountPage({ params }: PageProps<"/[lang]/account">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // Order totals here must read the same as the dashboard's: stored in USD,
  // shown in the visitor's display currency, exact rather than step-rounded.
  const display = await resolveDisplayCurrency(lang);
  const formatUsd = (cents: number) => formatDisplayAmount(cents, display);
  const dict = await getDictionary(lang);
  const account = await requireAccount(lang, `/${lang}/account`);

  const service = supabaseService();
  const { data: orders } = await service
    .from("orders")
    .select("id, order_number, status, total, created_at, claim_token")
    .or(`buyer_account_id.eq.${account.user_id},merchant_account_id.eq.${account.user_id}`)
    .order("created_at", { ascending: false })
    .limit(8);

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(LOCALE_TAGS[lang as Locale], { dateStyle: "medium" }).format(
      new Date(iso),
    );

  const tierName =
    account.tier === "elite"
      ? dict.tiers.eliteName
      : account.tier === "merchant"
        ? dict.tiers.merchantName
        : dict.tiers.buyerName;

  return (
    <div className="relative overflow-hidden">
      <div className="grid-mesh radial-fade absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <Reveal className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{dict.account.title}</h1>
            <p className="mt-2 text-ink-400">{dict.account.lead}</p>
          </div>
          <SignOutButton lang={lang} label={dict.account.signOutCta} />
        </Reveal>

        {/* Membership */}
        <Reveal delay={80} className="mt-8">
          <section className="panel p-6 sm:p-7" aria-labelledby="tier-heading">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2
                  id="tier-heading"
                  className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500"
                >
                  {dict.account.currentTier}
                </h2>
                <div className="mt-2.5 flex flex-wrap items-center gap-3">
                  <TierBadge tier={account.tier} label={tierName} />
                  <span className="text-sm text-ink-400">
                    {dict.account[TIER_STATUS_KEY[account.tier_status]]}
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink-600">
                  {dict.account.memberSince.replace("{date}", fmtDate(account.created_at))}
                  {account.tier_expires_at
                    ? ` · ${dict.account.renews.replace("{date}", fmtDate(account.tier_expires_at))}`
                    : ""}
                </p>
              </div>
              <ButtonLink href={`/${lang}/membership`} variant="secondary" size="sm">
                {dict.account.upgradeCta}
              </ButtonLink>
            </div>

            {atLeast(account.tier, "merchant") ? (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-accent-400/25 bg-accent-500/[0.07] p-4">
                <div className="flex items-start gap-3">
                  <span className="inline-flex size-9 items-center justify-center rounded-lg border border-accent-400/25 bg-accent-500/10 text-accent-300">
                    <Icon name="bolt" className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink-100">
                      {dict.account.dashboardCta}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">{dict.account.dashboardLead}</p>
                  </div>
                </div>
                <ButtonLink href={`/${lang}/dashboard`} size="sm">
                  {dict.nav.dashboard}
                  <Icon name="arrow-right" className="size-4" />
                </ButtonLink>
              </div>
            ) : null}
          </section>
        </Reveal>

        {/* Profile */}
        <Reveal delay={140} className="mt-4">
          <section className="panel p-6 sm:p-7" aria-labelledby="profile-heading">
            <h2 id="profile-heading" className="text-lg font-bold text-ink-50">
              {dict.account.profile}
            </h2>
            <p className="mt-1.5 text-sm text-ink-400">{dict.account.profileLead}</p>
            <div className="mt-6">
              <ProfileForm
                lang={lang}
                account={account}
                dict={{
                  fullName: dict.account.fullName,
                  companyName: dict.account.companyName,
                  country: dict.account.country,
                  phone: dict.account.phone,
                  phoneHint: dict.account.phoneHint,
                  vatNumber: dict.account.vatNumber,
                  vatHint: dict.account.vatHint,
                  email: dict.account.email,
                  emailLocked: dict.account.emailLocked,
                  save: dict.account.saveProfile,
                  saving: dict.common.saving,
                  saved: dict.account.profileSaved,
                  optional: dict.common.optional,
                  genericError: dict.errors.generic,
                }}
              />
            </div>
          </section>
        </Reveal>

        {/* Orders */}
        <Reveal delay={200} className="mt-4">
          <section className="panel overflow-hidden" aria-labelledby="orders-heading">
            <div className="border-b border-white/8 px-6 py-4">
              <h2 id="orders-heading" className="text-lg font-bold text-ink-50">
                {dict.account.recentOrders}
              </h2>
            </div>

            {orders && orders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/8 text-left">
                      <th scope="col" className="px-6 py-3 font-semibold text-ink-500">
                        {dict.account.orderNumber}
                      </th>
                      <th scope="col" className="px-6 py-3 font-semibold text-ink-500">
                        {dict.common.status}
                      </th>
                      <th scope="col" className="px-6 py-3 font-semibold text-ink-500">
                        {dict.common.date}
                      </th>
                      <th scope="col" className="px-6 py-3 text-right font-semibold text-ink-500">
                        {dict.common.total}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id as string} className="border-b border-white/5 last:border-0">
                        <td className="px-6 py-3.5 font-mono text-ink-200">
                          {order.order_number as string}
                        </td>
                        <td className="px-6 py-3.5">
                          <OrderStatusBadge
                            status={order.status as OrderStatus}
                            label={dict.orderStatus[order.status as OrderStatus]}
                          />
                        </td>
                        <td className="px-6 py-3.5 text-ink-400">
                          {fmtDate(order.created_at as string)}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono tabular-nums text-ink-200">
                          {formatUsd(toCents(String(order.total)))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-ink-400">{dict.account.noOrders}</p>
                <ButtonLink href={`/${lang}/catalog`} variant="secondary" size="sm" className="mt-4">
                  {dict.account.noOrdersCta}
                </ButtonLink>
              </div>
            )}
          </section>
        </Reveal>

        {/* Security */}
        <Reveal delay={250} className="mt-4">
          <section className="panel flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <h2 className="text-lg font-bold text-ink-50">{dict.account.securityTitle}</h2>
              <p className="mt-1 text-sm text-ink-400">{dict.account.securityLead}</p>
            </div>
            <Link
              href={`/${lang}/account/update-password`}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-5 text-sm font-semibold text-ink-100 transition-colors hover:border-accent-400/40 hover:bg-white/10"
            >
              {dict.account.changePassword}
            </Link>
          </section>
        </Reveal>
      </div>
    </div>
  );
}
