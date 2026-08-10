import { Reveal } from "@/components/ui/reveal";
import { Icon, type IconName } from "@/components/ui/icon";

export interface JourneyStep {
  icon: IconName;
  title: string;
  body: string;
}

/**
 * The inquiry-to-delivery rail.
 *
 * Four stations linked by a flowing connector so the section reads as one
 * process. The connector is drawn ONLY in the gaps between adjacent cards —
 * never as a full-width line behind them. An earlier version ran a single
 * spine behind the row, but the card panels are translucent with a backdrop
 * blur, so the bright dashes bled through and looked like the line was moving
 * across the cards. Per-gap segments can't overlap a card, so that can't happen.
 *
 * The connector is horizontal from `lg` (in the column gaps) and hidden below
 * it, where the cards stack vertically — recomposed, not scaled.
 */
export function Journey({ steps }: { steps: JourneyStep[] }) {
  return (
    <ol className="grid gap-4 lg:grid-cols-4 lg:gap-5">
      {steps.map((step, i) => (
        <Reveal key={step.title} delay={i * 90} as="li" className="relative">
          {/* Connector into the gap on this card's right (lg+, not the last). */}
          {i < steps.length - 1 ? (
            <span
              aria-hidden="true"
              className="absolute right-0 top-[3.4rem] z-0 hidden h-px w-4 translate-x-full overflow-hidden lg:block"
            >
              <span className="dash-flow-x block h-px w-full" />
            </span>
          ) : null}

          <div className="panel spotlight trace relative z-10 h-full p-6 lg:pt-7">
            <div className="flex items-center gap-3">
              <span className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-accent-400/25 bg-obsidian-800 text-accent-300">
                <Icon name={step.icon} className="size-5" />
                {/* Station light — the point the connector appears to enter. */}
                <span
                  aria-hidden="true"
                  className="absolute -inset-1 rounded-xl border border-accent-400/10"
                />
              </span>
              <span className="font-mono text-xs font-semibold tracking-[0.2em] text-ink-700">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <h3 className="mt-5 font-bold text-ink-50">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">{step.body}</p>
          </div>
        </Reveal>
      ))}
    </ol>
  );
}
