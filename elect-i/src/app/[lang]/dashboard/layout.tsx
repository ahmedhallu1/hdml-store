import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { requireTier } from "@/lib/auth";
import { toCents } from "@/lib/money";
import { formatDisplayAmount } from "@/lib/currency";
import { resolveDisplayCurrency } from "@/lib/display-currency";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { CurrencySwitcher } from "@/components/site/currency-switcher";
import { TierBadge } from "@/components/ui/badge";

/**
 * The whole /dashboard segment is Merchant-and-above. Gating in the layout
 * means a new page under it cannot forget to check.
 */
export default async function DashboardLayout({ children, params }: LayoutProps<"/[lang]/dashboard">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const { account, privileges } = await requireTier(lang, "merchant", `/${lang}/dashboard`);

  // Every figure under /dashboard is stored in USD and shown in the account's
  // display currency. The switcher sits in this header rather than only in the
  // site footer, so the currency can be changed without leaving the dashboard.
  const display = await resolveDisplayCurrency(lang);

  const tierName = account.tier === "elite" ? dict.tiers.eliteName : dict.tiers.merchantName;

  return (
    <div className="relative">
      <div className="grid-mesh radial-fade absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{dict.dashboard.title}</h1>
            <p className="mt-2 text-ink-400">{dict.dashboard.lead}</p>
          </div>
          <div className="text-right">
            <TierBadge tier={account.tier} label={tierName} />
            <p className="mt-2 text-xs text-ink-600">
              {dict.dashboard.signedInAs}{" "}
              <span className="text-ink-400">{account.email}</span>
            </p>
            <p className="mt-1 font-mono text-sm text-settled-400">
              {formatDisplayAmount(toCents(String(account.wallet_balance)), display)}
            </p>
            <div className="mt-3 flex justify-end">
              <Suspense fallback={null}>
                <CurrencySwitcher
                  current={display.code}
                  available={display.available}
                  label={dict.common.currency}
                  apply={dict.common.applyCurrency}
                />
              </Suspense>
            </div>
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[13rem_1fr]">
          <DashboardNav
            lang={lang}
            showApi={privileges.apiAccess !== "none"}
            labels={{
              overview: dict.dashboard.overview,
              onBehalf: dict.dashboard.onBehalf,
              orders: dict.dashboard.orders,
              wallet: dict.dashboard.wallet,
              billing: dict.billing.nav,
              api: dict.dashboard.api,
              team: dict.dashboard.team,
              settings: dict.dashboard.settings,
            }}
          />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
