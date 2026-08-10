import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, LOCALE_TAGS, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { requireTier } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { formatUsd, toCents } from "@/lib/money";
import { onBehalfCountThisMonth, claimUrlFor } from "@/lib/orders";
import type { OrderStatus } from "@/lib/db-types";
import { OnBehalfForm } from "@/components/dashboard/on-behalf-form";
import { CopyButton } from "@/components/dashboard/copy-button";
import { OrderStatusBadge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Prepaid links" };

export default async function OnBehalfPage({ params }: PageProps<"/[lang]/dashboard/on-behalf">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const { account, privileges } = await requireTier(lang, "merchant");

  const used = await onBehalfCountThisMonth(account.user_id);
  const limit = privileges.onBehalfOrdersPerMonth;

  const service = supabaseService();
  const { data: orders } = await service
    .from("orders")
    .select(
      "id, order_number, status, external_ref, total, claim_token, claim_expires_at, claimed_at, created_at",
    )
    .eq("merchant_account_id", account.user_id)
    .eq("on_behalf", true)
    .order("created_at", { ascending: false })
    .limit(25);

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(LOCALE_TAGS[lang as Locale], { dateStyle: "medium" }).format(
      new Date(iso),
    );

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <div>
          <h2 className="text-xl font-bold text-ink-50">{dict.dashboard.newOnBehalf}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-400">
            {dict.dashboard.onBehalfLead}
          </p>
          <p className="mt-3 flex items-center gap-2 text-xs text-ink-500">
            <Icon name="spark" className="size-3.5 text-accent-400" />
            {limit === null
              ? dict.tiers.unlimited
              : dict.dashboard.remainingThisMonth
                  .replace("{used}", String(used))
                  .replace("{limit}", String(limit))}
          </p>
        </div>
      </Reveal>

      <Reveal delay={80}>
        <OnBehalfForm
          lang={lang}
          canUseCredit={privileges.creditLimitCents > 0}
          dict={{
            externalRef: dict.dashboard.externalRef,
            externalRefHint: dict.dashboard.externalRefHint,
            lines: dict.dashboard.lines,
            sku: dict.dashboard.sku,
            qty: dict.product.qty,
            addLine: dict.dashboard.addLine,
            removeLine: dict.dashboard.removeLine,
            payFrom: dict.dashboard.payFrom,
            payWallet: dict.dashboard.payWallet,
            payCredit: dict.dashboard.payCredit,
            recipientEmail: dict.claim.email,
            recipientHint: dict.dashboard.recipientHint,
            note: dict.rfq.message,
            optional: dict.common.optional,
            submit: dict.dashboard.submit,
            submitting: dict.dashboard.submitting,
            createdTitle: dict.dashboard.createdTitle,
            createdBody: dict.dashboard.createdBody,
            claimLink: dict.dashboard.claimLink,
            copy: dict.common.copy,
            copied: dict.common.copied,
            createAnother: dict.dashboard.createAnother,
            orderNumber: dict.dashboard.orderNumber,
          }}
        />
      </Reveal>

      <Reveal delay={140}>
        <section className="panel overflow-hidden" aria-labelledby="links-heading">
          <div className="border-b border-white/8 px-5 py-4">
            <h2 id="links-heading" className="font-bold text-ink-50">
              {dict.dashboard.activeLinks}
            </h2>
          </div>

          {orders && orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-left">
                    <th scope="col" className="px-5 py-3 font-semibold text-ink-500">
                      {dict.dashboard.orderNumber}
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold text-ink-500">
                      {dict.dashboard.colRef}
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold text-ink-500">
                      {dict.common.status}
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold text-ink-500">
                      {dict.dashboard.colAmount}
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold text-ink-500">
                      {dict.dashboard.claimLink}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const token = o.claim_token as string | null;
                    const expiresAt = o.claim_expires_at as string | null;
                    const expired = Boolean(
                      expiresAt && !o.claimed_at && new Date(expiresAt) < new Date(),
                    );
                    return (
                      <tr key={o.id as string} className="border-b border-white/5 last:border-0">
                        <td className="px-5 py-3.5 font-mono text-xs text-ink-200">
                          {o.order_number as string}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-ink-400">
                          {(o.external_ref as string) ?? "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <OrderStatusBadge
                            status={o.status as OrderStatus}
                            label={dict.orderStatus[o.status as OrderStatus]}
                          />
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono tabular-nums text-ink-200">
                          {formatUsd(toCents(String(o.total)))}
                        </td>
                        <td className="px-5 py-3.5">
                          {/* The link stops being useful once claimed or expired,
                              so it is not offered for copying in those states. */}
                          {token && !o.claimed_at && !expired ? (
                            <div className="flex items-center gap-2">
                              <CopyButton
                                value={claimUrlFor(token, lang)}
                                label={dict.dashboard.copyLink}
                                copiedLabel={dict.common.copied}
                              />
                              {expiresAt ? (
                                <span className="whitespace-nowrap text-xs text-ink-600">
                                  {dict.dashboard.expiresOn.replace("{date}", fmtDate(expiresAt))}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-ink-600">
                              {expired ? dict.dashboard.expired : "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-ink-400">{dict.dashboard.noLinks}</p>
          )}
        </section>
      </Reveal>
    </div>
  );
}
