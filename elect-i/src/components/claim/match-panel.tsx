import { formatUsd } from "@/lib/money";
import type { Claim } from "@/lib/claim";
import { Icon } from "@/components/ui/icon";

/**
 * Side-by-side comparison of what the buyer ordered upstream versus what
 * ELECT-I will actually ship, sealed by two independently-computed HMAC
 * digests.
 *
 * The honesty of this panel matters more than its looks: when the upstream
 * system sent no snapshot there is nothing to compare, and the panel says so
 * plainly instead of implying a verification that did not happen.
 */

function formatAmount(cents: number, currency?: string): string {
  if (!currency || currency === "USD") return formatUsd(cents);
  const whole = Math.floor(Math.abs(cents) / 100).toLocaleString("en-US");
  const frac = String(Math.abs(cents) % 100).padStart(2, "0");
  return `${currency} ${whole}.${frac}`;
}

export function MatchPanel({
  claim,
  dict,
}: {
  claim: Claim;
  dict: {
    title: string;
    ok: string;
    okBody: string;
    fail: string;
    failBody: string;
    colItem: string;
    colQty: string;
    colOriginal: string;
    colThis: string;
    noComparison: string;
    noComparisonBody: string;
  };
}) {
  const comparable = claim.digestComparable && claim.externalLines.length > 0;
  const matched = comparable && claim.digestsMatch;

  return (
    <section
      className={
        matched
          ? "panel overflow-hidden border-settled-500/30"
          : comparable
            ? "panel overflow-hidden border-danger-500/40"
            : "panel overflow-hidden"
      }
      aria-labelledby="match-heading"
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-white/8 px-5 py-4">
        <span
          className={
            matched
              ? "inline-flex size-9 items-center justify-center rounded-lg bg-settled-500/15 text-settled-400"
              : comparable
                ? "inline-flex size-9 items-center justify-center rounded-lg bg-danger-500/15 text-danger-400"
                : "inline-flex size-9 items-center justify-center rounded-lg bg-white/5 text-ink-400"
          }
        >
          <Icon name={matched ? "check" : comparable ? "shield" : "package"} className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="match-heading" className="text-sm font-bold text-ink-100">
            {dict.title}
          </h2>
          <p
            className={
              matched
                ? "text-xs text-settled-400"
                : comparable
                  ? "text-xs font-semibold text-danger-400"
                  : "text-xs text-ink-500"
            }
          >
            {matched ? dict.ok : comparable ? dict.fail : dict.noComparison}
          </p>
        </div>
      </header>

      <p className="px-5 pt-4 text-sm leading-relaxed text-ink-400">
        {matched ? dict.okBody : comparable ? dict.failBody : dict.noComparisonBody}
      </p>

      {/* Wide table scrolls inside its own container so the page never does. */}
      <div className="overflow-x-auto px-5 pb-5 pt-4">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/8 text-left">
              <th scope="col" className="pb-2 pr-4 font-semibold text-ink-500">
                {dict.colItem}
              </th>
              <th scope="col" className="pb-2 pr-4 text-right font-semibold text-ink-500">
                {dict.colQty}
              </th>
              {comparable ? (
                <th scope="col" className="pb-2 pr-4 text-right font-semibold text-ink-500">
                  {dict.colOriginal}
                </th>
              ) : null}
              <th scope="col" className="pb-2 text-right font-semibold text-ink-500">
                {dict.colThis}
              </th>
            </tr>
          </thead>
          <tbody>
            {claim.lines.map((line, index) => {
              const upstream = claim.externalLines[index];
              const qtyMatches = !upstream || upstream.qty === line.qty;
              return (
                <tr key={`${line.sku ?? line.name}-${index}`} className="border-b border-white/5">
                  <td className="py-3 pr-4 align-top">
                    <span className="block text-ink-200">{line.name}</span>
                    {line.sku ? (
                      <span className="mt-0.5 block font-mono text-xs text-ink-600">{line.sku}</span>
                    ) : null}
                  </td>
                  <td
                    className={
                      qtyMatches
                        ? "py-3 pr-4 text-right align-top font-mono tabular-nums text-ink-300"
                        : "py-3 pr-4 text-right align-top font-mono tabular-nums font-bold text-danger-400"
                    }
                  >
                    {line.qty}
                  </td>
                  {comparable ? (
                    <td className="py-3 pr-4 text-right align-top font-mono tabular-nums text-ink-400">
                      {upstream
                        ? formatAmount(upstream.unitPriceCents * upstream.qty, upstream.currency)
                        : "—"}
                    </td>
                  ) : null}
                  <td className="py-3 text-right align-top font-mono tabular-nums text-ink-200">
                    {formatUsd(line.amountCents)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
