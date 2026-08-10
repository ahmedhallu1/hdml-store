import { cn } from "@/lib/cn";
import { Glyph } from "./glyph";

export interface ComparisonColumn {
  key: string;
  name: string;
  highlight?: boolean;
}

export interface ComparisonCell {
  /** Rendered value. Use "—" for "not included". */
  text: string;
  /** Whether the tier actually has the capability (drives colour, not text). */
  on: boolean;
}

export interface ComparisonRow {
  label: string;
  cells: ComparisonCell[];
}

export interface ComparisonGroup {
  title: string;
  rows: ComparisonRow[];
}

/**
 * Feature matrix. The table is wider than a phone, so it scrolls inside its
 * own container — the page itself never scrolls horizontally — and the row
 * label column stays pinned while the tier columns move.
 */
export function ComparisonTable({
  featureLabel,
  columns,
  groups,
}: {
  featureLabel: string;
  columns: ComparisonColumn[];
  groups: ComparisonGroup[];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[42rem] border-collapse text-left">
        <caption className="sr-only">{featureLabel}</caption>
        <thead>
          <tr className="border-b border-white/10">
            <th
              scope="col"
              className="sticky left-0 z-10 bg-obsidian-900 px-5 py-4 text-xs font-bold uppercase tracking-[0.18em] text-ink-400"
            >
              {featureLabel}
            </th>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  "min-w-36 px-5 py-4 text-sm font-bold",
                  col.highlight ? "bg-accent-500/[0.07] text-accent-200" : "text-ink-100",
                )}
              >
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.title}>
            <tr className="border-b border-white/8 bg-white/[0.03]">
              <th
                scope="colgroup"
                colSpan={columns.length + 1}
                className="px-5 py-2.5 text-xs font-bold uppercase tracking-[0.18em] text-ink-400"
              >
                {group.title}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.label} className="border-b border-white/5 last:border-0">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-obsidian-900 px-5 py-3.5 text-sm font-medium text-ink-300"
                >
                  {row.label}
                </th>
                {row.cells.map((cell, i) => (
                  <td
                    key={columns[i]?.key ?? i}
                    className={cn(
                      "px-5 py-3.5 text-sm",
                      columns[i]?.highlight && "bg-accent-500/[0.05]",
                      cell.on ? "font-semibold text-accent-200" : "text-ink-400",
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {cell.on ? (
                        <Glyph name="check" className="size-4 shrink-0 text-accent-300" />
                      ) : null}
                      {cell.text}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
