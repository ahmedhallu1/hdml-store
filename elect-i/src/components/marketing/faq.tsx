/**
 * FAQ accordion built on native <details>/<summary>: it works with JavaScript
 * disabled, is keyboard operable for free, and has nothing to neutralise under
 * prefers-reduced-motion beyond the rotation, which globals.css already
 * flattens.
 */
export function Faq({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <div className="divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
      {items.map((item) => (
        <details key={item.q} className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-semibold text-ink-100 transition-colors duration-200 hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden">
            {item.q}
            <span
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-white/12 text-accent-300 transition-transform duration-200 group-open:rotate-45"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </summary>
          <p className="px-5 pb-5 text-sm leading-relaxed text-ink-400">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
