"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { SORTS, type CatalogSort } from "@/lib/catalog-shared";

/**
 * Sort control.
 *
 * It is a real GET form pointed at the same route, so it keeps working with
 * JavaScript disabled (the submit button is only visible on focus, matching the
 * skip-link pattern). With JavaScript, changing the select navigates straight
 * away — no second click.
 *
 * The current filters arrive as props rather than from `useSearchParams`, so
 * this component never forces a Suspense boundary on the page.
 */
export function SortSelect({
  action,
  params,
  value,
  label,
  optionLabels,
  applyLabel,
}: {
  action: string;
  params: Record<string, string>;
  value: CatalogSort;
  label: string;
  optionLabels: Record<CatalogSort, string>;
  applyLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form action={action} method="get" className="flex items-center gap-2">
      {Object.entries(params).map(([key, val]) => (
        <input key={key} type="hidden" name={key} value={val} />
      ))}

      <label htmlFor="catalog-sort" className="whitespace-nowrap text-sm text-ink-400">
        {label}
      </label>

      <select
        id="catalog-sort"
        name="sort"
        defaultValue={value}
        disabled={pending}
        onChange={(event) => {
          const next = new URLSearchParams(params);
          if (event.target.value !== "relevance") next.set("sort", event.target.value);
          const qs = next.toString();
          startTransition(() => router.push(qs ? `${action}?${qs}` : action));
        }}
        className="min-h-11 cursor-pointer appearance-none rounded-xl border border-white/12 bg-obsidian-800/70 py-2 pl-3.5 pr-9 text-sm text-ink-100 transition-colors duration-200 hover:border-white/20 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-400/30 disabled:opacity-60"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='m4 6 4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 0.7rem center",
          backgroundSize: "1rem",
        }}
      >
        {SORTS.map((sort) => (
          <option key={sort} value={sort}>
            {optionLabels[sort]}
          </option>
        ))}
      </select>

      <button
        type="submit"
        className="sr-only cursor-pointer focus:not-sr-only focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-xl focus:bg-accent-500 focus:px-4 focus:font-semibold focus:text-obsidian-950"
      >
        {applyLabel}
      </button>
    </form>
  );
}
