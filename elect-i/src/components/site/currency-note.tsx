import type { Dictionary } from "@/i18n";
import type { DisplayCurrency } from "@/lib/currency";
import { cn } from "@/lib/cn";
import { fill } from "@/components/catalog/labels";

/**
 * The quiet disclosure that sits under converted prices.
 *
 * Renders nothing at all when the visitor is seeing USD: there is nothing to
 * disclose, and a note that appears on every page regardless of whether it
 * applies stops being read. A buyer comparing quotes needs to know that the
 * number in front of them is a courtesy conversion and that the contract,
 * the invoice and the amount they will actually pay are in dollars.
 */
export function CurrencyNote({
  display,
  dict,
  className,
}: {
  display: DisplayCurrency;
  dict: Dictionary;
  className?: string;
}) {
  if (!display.converted) return null;
  return (
    <p className={cn("text-xs leading-relaxed text-ink-500", className)}>
      {fill(dict.common.currencyNote, { currency: display.code })}
    </p>
  );
}
