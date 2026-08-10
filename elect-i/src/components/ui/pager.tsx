import Link from "next/link";
import { interpolate } from "@/lib/validation";

export interface PagerLabels {
  /** e.g. "{from}–{to} of {total}" */
  range: string;
  previous: string;
  next: string;
}

/**
 * Link-based pagination for the long history tables.
 *
 * Deliberately server-rendered with plain <Link>s rather than a client
 * component: the page number lives in the URL, so a row the user is looking at
 * stays shareable and the browser's back button behaves.
 */
export function Pager({
  basePath,
  query,
  page,
  pageSize,
  total,
  labels,
}: {
  basePath: string;
  /** Extra query params to carry across pages (filters, etc.). */
  query?: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
  labels: PagerLabels;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) if (value) params.set(key, value);
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 px-5 py-3.5"
      aria-label={labels.next}
    >
      <p className="font-mono text-xs tabular-nums text-ink-500">
        {interpolate(labels.range, { from: fmt(from), to: fmt(to), total: fmt(total) })}
      </p>
      <div className="flex items-center gap-2">
        <Step href={href(page - 1)} disabled={page <= 1} label={labels.previous} />
        <Step href={href(page + 1)} disabled={page >= pageCount} label={labels.next} />
      </div>
    </nav>
  );
}

function Step({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
  const base =
    "inline-flex min-h-9 items-center rounded-lg border px-3 text-xs font-semibold transition-colors";
  if (disabled) {
    return (
      <span aria-disabled className={`${base} border-white/6 text-ink-700`}>
        {label}
      </span>
    );
  }
  return (
    <Link href={href} className={`${base} border-white/12 text-ink-300 hover:border-accent-400/40 hover:text-accent-200`}>
      {label}
    </Link>
  );
}
