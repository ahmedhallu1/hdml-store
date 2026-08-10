"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Locale } from "@/i18n/config";
import type { OrderStatus } from "@/lib/db-types";
import { Icon } from "@/components/ui/icon";

/**
 * Free-text search over the merchant's own order history.
 *
 * Submits to the URL rather than filtering in place, so a search is linkable
 * and the back button works — the same contract the status filter and pager
 * already follow. Searching resets to page 1; a stale `?page=12` would other-
 * wise land on an empty page.
 */
export function OrderSearch({
  lang,
  current,
  status,
  label,
  clearLabel,
}: {
  lang: Locale;
  current: string;
  status: OrderStatus | null;
  label: string;
  clearLabel: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [synced, setSynced] = useState(current);
  const [pending, startTransition] = useTransition();

  // Re-sync the field when the term in the URL changes from elsewhere — back /
  // forward navigation, mainly. Adjusting during render rather than in an
  // effect avoids a second render pass and keeps focus in the box.
  if (current !== synced) {
    setSynced(current);
    setValue(current);
  }

  const go = (term: string) => {
    const params = new URLSearchParams();
    if (term) params.set("q", term);
    if (status) params.set("status", status);
    const qs = params.toString();
    startTransition(() => router.push(`/${lang}/dashboard/orders${qs ? `?${qs}` : ""}`));
  };

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        go(value.trim());
      }}
      className="relative flex min-w-0 items-center"
    >
      <label htmlFor="order-search" className="sr-only">
        {label}
      </label>
      <Icon
        name="search"
        aria-hidden="true"
        className="pointer-events-none absolute left-3 size-4 text-ink-500"
      />
      <input
        id="order-search"
        type="search"
        name="q"
        value={value}
        disabled={pending}
        onChange={(event) => setValue(event.target.value)}
        placeholder={label}
        autoComplete="off"
        className="min-h-9 w-full min-w-0 rounded-lg border border-white/12 bg-obsidian-800 pl-9 pr-9 text-sm text-ink-100 placeholder:text-ink-600 transition-colors hover:border-white/20 focus:border-accent-400 focus:outline-none disabled:opacity-50 sm:w-72"
      />
      {current ? (
        <button
          type="button"
          onClick={() => {
            setValue("");
            go("");
          }}
          aria-label={clearLabel}
          className="absolute right-2 inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-base leading-none text-ink-500 transition-colors hover:text-ink-200"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      ) : null}
    </form>
  );
}
