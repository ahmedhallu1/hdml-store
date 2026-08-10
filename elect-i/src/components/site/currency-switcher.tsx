"use client";

import { useRef, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { setDisplayCurrencyAction } from "@/server/actions/currency";
import { CURRENCIES, type CurrencyCode } from "@/lib/currency";

/**
 * Is this render happening in a browser that ran our JavaScript?
 *
 * `false` in the server snapshot and `true` in the client one, so the markup
 * shipped to a scriptless browser keeps the submit button and the hydrated
 * one drops it. No effect, no state, nothing to get out of sync.
 */
const NEVER_CHANGES = () => () => {};
function useScripted(): boolean {
  return useSyncExternalStore(
    NEVER_CHANGES,
    () => true,
    () => false,
  );
}

/**
 * Currency picker.
 *
 * A real <form> posting to a Server Action, so it is not JavaScript that makes
 * it work: without scripting the browser submits normally and the "Apply"
 * button is the control. With scripting, changing the select submits the form
 * and the redundant button is removed — nothing is ever left in a state where
 * a choice cannot be applied.
 *
 * `next` carries the current path and query so a buyer three filters deep into
 * the catalogue comes back to the same results, not to the home page.
 */
export function CurrencySwitcher({
  current,
  available,
  label,
  apply,
}: {
  current: CurrencyCode;
  available: CurrencyCode[];
  label: string;
  apply: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const scripted = useScripted();

  // One option is no choice at all — hide the control rather than show a
  // select that cannot change anything.
  if (available.length < 2) return null;

  const query = searchParams.toString();
  const next = `${pathname}${query ? `?${query}` : ""}`;

  return (
    <form
      ref={formRef}
      action={setDisplayCurrencyAction}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="next" value={next} />
      <label className="relative inline-flex items-center">
        <span className="sr-only">{label}</span>
        <svg
          viewBox="0 0 16 16"
          className="pointer-events-none absolute left-2.5 size-4 text-ink-400"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M10.2 6.1C9.8 5.4 9 5 8 5c-1.2 0-2 .6-2 1.5S6.8 8 8 8s2 .6 2 1.5S9.2 11 8 11c-1 0-1.8-.4-2.2-1.1M8 3.6v8.8"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
        <select
          name="currency"
          defaultValue={current}
          onChange={() => formRef.current?.requestSubmit()}
          className="cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-7 text-sm font-medium text-ink-300 transition-colors hover:border-white/20 hover:text-ink-100 focus:border-accent-400 focus:outline-none"
        >
          {available.map((code) => (
            <option key={code} value={code} className="bg-obsidian-800 text-ink-100">
              {code} · {CURRENCIES[code].name}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 16 16"
          className="pointer-events-none absolute right-2 size-3.5 text-ink-500"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m4 6 4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </label>
      {scripted ? null : (
        <button
          type="submit"
          className="min-h-9 cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-ink-300 hover:border-white/20 hover:text-ink-100"
        >
          {apply}
        </button>
      )}
    </form>
  );
}
