import { formatDisplayPrice, type DisplayCurrency } from "@/lib/currency";
import type { PriceLadderRow } from "@/lib/catalog-shared";
import type { Dictionary } from "@/i18n";
import { fill } from "./labels";

/**
 * The quantity ladder as a real table — buyers compare these numbers column by
 * column, and a table is the only structure that lets a screen reader announce
 * "1,000+ units, your price, $4.10".
 *
 * Wide content scrolls inside its own container so the page never scrolls
 * sideways on a 375px screen.
 */
export function PriceBreakTable({
  ladder,
  dict,
  unit,
  showSavings,
  display,
}: {
  ladder: PriceLadderRow[];
  dict: Dictionary;
  unit: string;
  showSavings: boolean;
  display: DisplayCurrency;
}) {
  if (ladder.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-[calc(var(--radius-card)-1px)] border border-white/8">
      <table className="w-full min-w-[22rem] border-collapse text-sm">
        <caption className="sr-only">{dict.product.quantityBreaks}</caption>
        <thead>
          <tr className="bg-white/[0.04] text-left">
            <th scope="col" className="px-4 py-3 font-semibold text-ink-300">
              {dict.product.ladderQty}
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold text-ink-300">
              {dict.product.ladderList}
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold text-accent-200">
              {dict.product.ladderYour}
            </th>
            {showSavings ? (
              <th scope="col" className="px-4 py-3 text-right font-semibold text-ink-300">
                {dict.product.ladderSave}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {ladder.map((row) => {
            const saving = Math.max(0, row.listCents - row.yourCents);
            return (
              <tr key={row.minQty} className="border-t border-white/6">
                <th
                  scope="row"
                  className="whitespace-nowrap px-4 py-3 text-left font-mono text-ink-100"
                >
                  {fill(dict.product.ladderFrom, {
                    qty: row.minQty.toLocaleString("en-US"),
                  })}
                </th>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-ink-400">
                  {formatDisplayPrice(row.listCents, display)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold tabular-nums text-ink-50">
                  {formatDisplayPrice(row.yourCents, display)}
                </td>
                {showSavings ? (
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-settled-400">
                    {saving > 0 ? `−${formatDisplayPrice(saving, display)}` : "—"}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-white/6 px-4 py-2.5 text-xs text-ink-500">
        {dict.common.perUnit} · {unit}
      </p>
    </div>
  );
}
