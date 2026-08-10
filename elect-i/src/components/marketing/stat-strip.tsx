import type { ReactNode } from "react";

/**
 * Hairline stat row. Values are passed as nodes so callers can drop a
 * <Counter> in without this component owning any animation.
 */
export function StatStrip({
  items,
}: {
  items: Array<{ label: string; value: ReactNode; note?: string }>;
}) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-obsidian-900 px-5 py-6">
          <dt className="text-xs font-semibold uppercase tracking-wider text-ink-400">
            {item.label}
          </dt>
          <dd className="mt-2 font-mono text-2xl font-semibold text-accent-300 sm:text-3xl">
            {item.value}
          </dd>
          {item.note ? (
            <p className="mt-1.5 text-xs leading-relaxed text-ink-400">{item.note}</p>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
