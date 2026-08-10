"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Locale } from "@/i18n/config";
import type { OrderStatus } from "@/lib/db-types";
import { ORDER_STATUSES } from "@/lib/validation";

/** Status filter that writes to the URL, so a filtered view is linkable. */
export function OrderStatusFilter({
  lang,
  current,
  search,
  label,
  allLabel,
  labels,
}: {
  lang: Locale;
  current: OrderStatus | null;
  /** Active search term, carried across so changing status keeps it. */
  search?: string;
  label: string;
  allLabel: string;
  labels: Record<OrderStatus, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="inline-flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</span>
      <select
        value={current ?? ""}
        disabled={pending}
        onChange={(e) => {
          const value = e.target.value;
          const params = new URLSearchParams();
          if (search) params.set("q", search);
          if (value) params.set("status", value);
          const qs = params.toString();
          startTransition(() =>
            router.push(`/${lang}/dashboard/orders${qs ? `?${qs}` : ""}`),
          );
        }}
        className="min-h-9 cursor-pointer rounded-lg border border-white/12 bg-obsidian-800 px-3 text-sm text-ink-200 transition-colors hover:border-white/20 focus:border-accent-400 focus:outline-none disabled:opacity-50"
      >
        <option value="">{allLabel}</option>
        {ORDER_STATUSES.map((status) => (
          <option key={status} value={status}>
            {labels[status]}
          </option>
        ))}
      </select>
    </label>
  );
}
