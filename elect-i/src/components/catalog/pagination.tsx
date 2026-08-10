import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";
import type { Dictionary } from "@/i18n";
import { fill } from "./labels";

/**
 * Page links are real anchors carrying the full filter state, so results are
 * shareable, crawlable and survive the back button. Rel prev/next is emitted
 * for the same reason.
 */
export function Pagination({
  action,
  params,
  page,
  totalPages,
  dict,
}: {
  action: string;
  params: Record<string, string>;
  page: number;
  totalPages: number;
  dict: Dictionary;
}) {
  if (totalPages <= 1) return null;

  const href = (target: number) => {
    const next = new URLSearchParams(params);
    if (target > 1) next.set("page", String(target));
    else next.delete("page");
    const qs = next.toString();
    return qs ? `${action}?${qs}` : action;
  };

  return (
    <nav aria-label={dict.catalog.pagination} className="mt-10 flex flex-col items-center gap-3">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li>
          {page > 1 ? (
            <Link href={href(page - 1)} rel="prev" className={cn(STEP, ENABLED)}>
              <Icon name="arrow-right" className="size-4 rotate-180" />
              <span className="hidden sm:inline">{dict.catalog.previousPage}</span>
            </Link>
          ) : (
            <span className={cn(STEP, DISABLED)} aria-hidden="true">
              <Icon name="arrow-right" className="size-4 rotate-180" />
              <span className="hidden sm:inline">{dict.catalog.previousPage}</span>
            </span>
          )}
        </li>

        {pageWindow(page, totalPages).map((entry, index) =>
          entry === "gap" ? (
            <li
              key={`gap-${index}`}
              aria-hidden="true"
              className="grid size-11 place-items-center text-ink-600"
            >
              …
            </li>
          ) : (
            <li key={entry}>
              <Link
                href={href(entry)}
                aria-current={entry === page ? "page" : undefined}
                aria-label={fill(dict.catalog.goToPage, { page: entry })}
                className={cn(
                  "grid size-11 cursor-pointer place-items-center rounded-xl font-mono text-sm transition-all duration-200",
                  entry === page
                    ? "border border-accent-400/50 bg-accent-500/15 font-bold text-accent-200"
                    : "border border-white/10 text-ink-300 hover:border-accent-400/40 hover:bg-white/5 hover:text-ink-50",
                )}
              >
                {entry}
              </Link>
            </li>
          ),
        )}

        <li>
          {page < totalPages ? (
            <Link href={href(page + 1)} rel="next" className={cn(STEP, ENABLED)}>
              <span className="hidden sm:inline">{dict.catalog.nextPage}</span>
              <Icon name="arrow-right" className="size-4" />
            </Link>
          ) : (
            <span className={cn(STEP, DISABLED)} aria-hidden="true">
              <span className="hidden sm:inline">{dict.catalog.nextPage}</span>
              <Icon name="arrow-right" className="size-4" />
            </span>
          )}
        </li>
      </ul>

      <p className="text-xs text-ink-500">
        {fill(dict.catalog.page, { current: page, total: totalPages })}
      </p>
    </nav>
  );
}

const STEP =
  "inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-all duration-200";
const ENABLED =
  "cursor-pointer border-white/10 text-ink-300 hover:border-accent-400/40 hover:bg-white/5 hover:text-ink-50";
const DISABLED = "border-white/5 text-ink-600";

/** 1 … 4 [5] 6 … 20 — never more than 7 slots, so it fits a 375px screen. */
function pageWindow(page: number, total: number): Array<number | "gap"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const out: Array<number | "gap"> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);

  if (start > 2) out.push("gap");
  for (let i = start; i <= end; i += 1) out.push(i);
  if (end < total - 1) out.push("gap");
  out.push(total);
  return out;
}
