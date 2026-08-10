import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, LOCALE_TAGS, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { requireTier } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { formatUsd, toCents } from "@/lib/money";
import {
  interpolate,
  orderSearchSchema,
  orderSearchTokens,
  orderStatusFilterSchema,
  pageParamSchema,
} from "@/lib/validation";
import type { OrderStatus } from "@/lib/db-types";
import { Reveal } from "@/components/ui/reveal";
import { OrderStatusBadge, Badge } from "@/components/ui/badge";
import { Pager } from "@/components/ui/pager";
import { OrderStatusFilter } from "@/components/dashboard/order-status-filter";
import { OrderSearch } from "@/components/dashboard/order-search";

export const metadata: Metadata = { title: "Orders" };

const PAGE_SIZE = 50;

export default async function DashboardOrdersPage({
  params,
  searchParams,
}: PageProps<"/[lang]/dashboard/orders">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const { account } = await requireTier(lang, "merchant");

  // `.catch(null)` in the schema means a junk status in the URL falls back to
  // "no filter" rather than throwing.
  const status = orderStatusFilterSchema.parse(
    Array.isArray(sp.status) ? sp.status[0] : sp.status,
  );
  const page = pageParamSchema.parse(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const search = orderSearchSchema.parse(Array.isArray(sp.q) ? sp.q[0] : (sp.q ?? ""));
  const offset = (page - 1) * PAGE_SIZE;

  const service = supabaseService();
  // `count: "exact"` rides along on the same request, so the pager knows the
  // real total without a second round trip.
  let query = service
    .from("orders")
    .select(
      "id, order_number, status, on_behalf, external_ref, recipient_name, recipient_email, recipient_country, total, created_at",
      { count: "exact" },
    )
    .or(`merchant_account_id.eq.${account.user_id},buyer_account_id.eq.${account.user_id}`)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  // Every token must match somewhere. PostgREST ANDs repeated `or=` params, so
  // one .or() per token gives token-AND, field-OR — and it ANDs against the
  // ownership filter above rather than widening it.
  for (const token of orderSearchTokens(search)) {
    query = query.or(
      `order_number.ilike.%${token}%,external_ref.ilike.%${token}%,` +
        `recipient_name.ilike.%${token}%,recipient_email.ilike.%${token}%`,
    );
  }

  const { data: orders, count } = await query;
  const total = count ?? orders?.length ?? 0;

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(LOCALE_TAGS[lang as Locale], { dateStyle: "medium" }).format(
      new Date(iso),
    );

  return (
    <div className="flex flex-col gap-6">
      <Reveal className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-ink-400">{dict.dashboard.ordersLead}</p>
        <div className="flex flex-wrap items-center gap-3">
          <OrderSearch
            lang={lang}
            current={search}
            status={status}
            label={dict.dashboard.searchOrders}
            clearLabel={dict.common.clear}
          />
          <OrderStatusFilter
            lang={lang}
            current={status}
            search={search}
            label={dict.dashboard.filterStatus}
            allLabel={dict.common.all}
            labels={dict.orderStatus}
          />
        </div>
      </Reveal>

      <Reveal delay={60}>
        <section className="panel overflow-hidden">
          {orders && orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-left">
                    <th scope="col" className="px-5 py-3 font-semibold text-ink-500">
                      {dict.dashboard.colOrder}
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold text-ink-500">
                      {dict.dashboard.colType}
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold text-ink-500">
                      {dict.dashboard.colRecipient}
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold text-ink-500">
                      {dict.common.status}
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold text-ink-500">
                      {dict.common.date}
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold text-ink-500">
                      {dict.common.total}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id as string} className="border-b border-white/5 last:border-0">
                      <td className="px-5 py-3.5">
                        <span className="block font-mono text-xs text-ink-200">
                          {o.order_number as string}
                        </span>
                        {o.external_ref ? (
                          <span className="mt-0.5 block font-mono text-[11px] text-ink-600">
                            {o.external_ref as string}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={o.on_behalf ? "accent" : "neutral"}>
                          {o.on_behalf ? dict.dashboard.typeOnBehalf : dict.dashboard.typeDirect}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-ink-300">
                        {o.recipient_name ? (
                          <>
                            {o.recipient_name as string}
                            {o.recipient_country ? (
                              <span className="ml-1.5 text-xs text-ink-600">
                                {o.recipient_country as string}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-ink-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <OrderStatusBadge
                          status={o.status as OrderStatus}
                          label={dict.orderStatus[o.status as OrderStatus]}
                        />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-xs text-ink-500">
                        {fmtDate(o.created_at as string)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-ink-200">
                        {formatUsd(toCents(String(o.total)))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-12 text-center text-sm text-ink-400">
              {search
                ? interpolate(dict.dashboard.noOrdersForSearch, { term: search })
                : status
                  ? dict.dashboard.noOrdersForFilter
                  : dict.dashboard.noOrders}
            </p>
          )}
          <Pager
            basePath={`/${lang}/dashboard/orders`}
            query={{ q: search || undefined, status: status ?? undefined }}
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
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
