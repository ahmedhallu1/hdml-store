import Link from "next/link";
import { cn } from "@/lib/cn";

export interface PaginationProps {
  page: number;
  pageCount: number;
  /** Path the page links point at, e.g. "/catalog". */
  basePath: string;
  /** Current filter params to preserve (WITHOUT "page"). */
  searchParams?: Record<string, string>;
}

function pageHref(basePath: string, params: Record<string, string>, page: number): string {
  const sp = new URLSearchParams(params);
  sp.delete("page");
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** 1 … p-1 p p+1 … last, with "gap" markers where pages are skipped. */
function pageWindow(page: number, pageCount: number): Array<number | "gap"> {
  const wanted = new Set([1, page - 1, page, page + 1, pageCount]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  let prev = 0;
  for (const p of pages) {
    if (prev !== 0 && p - prev > 1) out.push("gap");
    out.push(p);
    prev = p;
  }
  return out;
}

const itemBase =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-medium transition-colors";

function Arrow({ direction }: { direction: "prev" | "next" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden
    >
      {direction === "prev" ? <path d="M15 6l-6 6 6 6" /> : <path d="M9 6l6 6-6 6" />}
    </svg>
  );
}

/** Accessible pagination that preserves the active filter query params. */
export function Pagination({ page, pageCount, basePath, searchParams = {} }: PaginationProps) {
  if (pageCount <= 1) return null;
  const current = Math.min(Math.max(1, page), pageCount);

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-1.5">
      {current > 1 ? (
        <Link
          href={pageHref(basePath, searchParams, current - 1)}
          rel="prev"
          className={cn(itemBase, "border-gray-200 text-gray-700 hover:border-brand-300 hover:text-brand-800")}
        >
          <Arrow direction="prev" />
          <span className="sr-only">Previous page</span>
        </Link>
      ) : (
        <span aria-hidden className={cn(itemBase, "cursor-not-allowed border-gray-100 text-gray-300")}>
          <Arrow direction="prev" />
        </span>
      )}

      {pageWindow(current, pageCount).map((item, i) =>
        item === "gap" ? (
          <span key={`gap-${i}`} aria-hidden className="px-1 text-sm text-gray-400">
            …
          </span>
        ) : (
          <Link
            key={item}
            href={pageHref(basePath, searchParams, item)}
            aria-current={item === current ? "page" : undefined}
            aria-label={`Page ${item}`}
            className={cn(
              itemBase,
              item === current
                ? "border-brand-700 bg-brand-700 text-white"
                : "border-gray-200 text-gray-700 hover:border-brand-300 hover:text-brand-800",
            )}
          >
            {item}
          </Link>
        ),
      )}

      {current < pageCount ? (
        <Link
          href={pageHref(basePath, searchParams, current + 1)}
          rel="next"
          className={cn(itemBase, "border-gray-200 text-gray-700 hover:border-brand-300 hover:text-brand-800")}
        >
          <Arrow direction="next" />
          <span className="sr-only">Next page</span>
        </Link>
      ) : (
        <span aria-hidden className={cn(itemBase, "cursor-not-allowed border-gray-100 text-gray-300")}>
          <Arrow direction="next" />
        </span>
      )}
    </nav>
  );
}
