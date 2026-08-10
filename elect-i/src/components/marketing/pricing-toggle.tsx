"use client";

import { useState } from "react";
import Link from "next/link";
import { TIER_PRICING, TIER_PRIVILEGES, type Tier } from "@/lib/tiers";
import { formatDisplayPrice, type DisplayCurrency } from "@/lib/currency";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";

export interface PlanCopy {
  tier: Tier;
  name: string;
  tagline: string;
  highlights: string[];
}

export interface PricingDict {
  monthly: string;
  annual: string;
  annualNote: string;
  perMonth: string;
  perYear: string;
  equivalentMonthly: string;
  billedAnnually: string;
  free: string;
  choosePlan: string;
  mostPopular: string;
}

/**
 * Tier cards with a monthly/annual toggle. Every number comes from
 * TIER_PRICING / TIER_PRIVILEGES — the same constants the order engine and API
 * enforce — so the marketing page can never drift from what is charged.
 */
export function PricingToggle({
  lang,
  plans,
  highlightTier,
  display,
  dict,
}: {
  lang: string;
  plans: PlanCopy[];
  highlightTier: Tier | null;
  /** Presentation only — subscriptions are still billed in USD. */
  display: DisplayCurrency;
  dict: PricingDict;
}) {
  const [annual, setAnnual] = useState(true);

  return (
    <div>
      <div className="flex justify-center">
        <div
          role="group"
          aria-label={`${dict.monthly} / ${dict.annual}`}
          className="relative inline-flex items-center rounded-full border border-white/12 bg-white/[0.03] p-1"
        >
          {/* Sliding highlight: one moving element across two equal-width
              segments, so the control reads as a single unit rather than two
              buttons swapping colour. */}
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white/10 shadow-[inset_0_0_0_1px_rgba(23,200,210,0.25)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: annual ? "translateX(calc(100% + 0.5rem))" : "translateX(0)" }}
          />
          <button
            type="button"
            onClick={() => setAnnual(false)}
            aria-pressed={!annual}
            className={cn(
              "relative z-10 min-h-9 w-28 cursor-pointer rounded-full text-sm font-semibold transition-colors",
              !annual ? "text-ink-50" : "text-ink-400 hover:text-ink-200",
            )}
          >
            {dict.monthly}
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            aria-pressed={annual}
            className={cn(
              "relative z-10 min-h-9 w-28 cursor-pointer rounded-full text-sm font-semibold transition-colors",
              annual ? "text-ink-50" : "text-ink-400 hover:text-ink-200",
            )}
          >
            {dict.annual}
          </button>

          {/* Savings badge floats above the annual segment; kept out of the
              track so both segments stay equal width. */}
          <span className="pointer-events-none absolute -top-2.5 right-2 rounded-full border border-settled-500/30 bg-obsidian-900 px-2 py-0.5 text-[10px] font-semibold text-settled-400">
            {dict.annualNote}
          </span>
        </div>
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const price = TIER_PRICING[plan.tier];
          const priv = TIER_PRIVILEGES[plan.tier];
          const free = price.monthlyCents === 0;
          const featured = highlightTier ? plan.tier === highlightTier : plan.tier === "merchant";
          const shownCents = annual ? price.annualCents : price.monthlyCents;

          return (
            // Wrapper stays overflow-visible so the floating badge is never
            // clipped by the featured card's `sweep` (overflow:hidden).
            <div key={plan.tier} className="relative h-full">
              {featured ? (
                <span className="absolute -top-3 left-7 z-20">
                  <Badge tone="accent">{dict.mostPopular}</Badge>
                </span>
              ) : null}
              <div
                className={cn(
                  "panel spotlight h-full p-7",
                  featured &&
                    "sweep border-accent-400/40 [box-shadow:0_0_0_1px_rgba(23,200,210,.2),0_20px_60px_-20px_rgba(6,166,180,.4)]",
                )}
              >
              <h3 className="text-lg font-bold text-ink-50">{plan.name}</h3>
              <p className="mt-1.5 min-h-10 text-sm leading-relaxed text-ink-500">{plan.tagline}</p>

              <p className="mt-5 flex items-baseline gap-1.5">
                <span
                  key={shownCents}
                  className="value-pop inline-block font-mono text-4xl font-semibold text-ink-50"
                >
                  {free ? dict.free : formatDisplayPrice(shownCents, display)}
                </span>
                {!free ? (
                  <span className="text-sm text-ink-500">
                    {annual ? `/${dict.perYear}` : `/${dict.perMonth}`}
                  </span>
                ) : null}
              </p>
              {!free ? (
                <p className="mt-1.5 text-xs text-ink-500">
                  {annual
                    ? dict.equivalentMonthly.replace(
                        "{amount}",
                        formatDisplayPrice(Math.round(price.annualCents / 12), display),
                      )
                    : dict.billedAnnually.replace(
                        "{amount}",
                        formatDisplayPrice(price.annualCents, display),
                      )}
                </p>
              ) : null}

              <ul className="mt-6 space-y-2.5 text-sm">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2.5 text-ink-300">
                    <Icon name="check" className="mt-0.5 size-4 shrink-0 text-accent-400" />
                    {h}
                  </li>
                ))}
              </ul>

              <Link
                href={free ? `/${lang}/register` : `/${lang}/register?next=/${lang}/dashboard`}
                className={cn(
                  "mt-7 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl px-5 font-bold transition-all duration-200 active:scale-[0.98]",
                  featured
                    ? "bg-gradient-to-r from-accent-500 to-accent-400 text-obsidian-950 glow-accent"
                    : "border border-white/12 bg-white/5 text-ink-100 hover:border-accent-400/40 hover:bg-white/10",
                )}
              >
                {dict.choosePlan}
              </Link>

              {priv.discountBps > 0 ? (
                <p className="mt-3 text-center font-mono text-xs text-accent-400">
                  −{priv.discountBps / 100}% wholesale
                </p>
              ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
