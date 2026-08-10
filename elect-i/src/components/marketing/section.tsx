import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Reveal } from "@/components/ui/reveal";
import { Glyph, type GlyphName } from "./glyph";

/**
 * Shared page furniture for the marketing and legal routes, matching the
 * rhythm of the home page: hairline section dividers, a 7xl container, and
 * Reveal-staggered blocks.
 */

export function PageHero({
  kicker,
  title,
  lead,
  children,
  align = "left",
}: {
  kicker?: string;
  title: string;
  lead?: string;
  children?: ReactNode;
  align?: "left" | "center";
}) {
  const centered = align === "center";
  return (
    <section className="grain relative overflow-hidden">
      <div className="grid-mesh radial-fade absolute inset-0" aria-hidden="true" />
      <div
        className="pointer-events-none absolute left-1/3 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-accent-500/12 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-obsidian-900"
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative mx-auto max-w-[92rem] px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pb-24 lg:pt-28",
          centered && "text-center",
        )}
      >
        <div className={cn("max-w-3xl", centered && "mx-auto")}>
          {kicker ? (
            <Reveal>
              <span className="inline-flex items-center gap-2.5 rounded-full border border-accent-400/25 bg-accent-500/[0.08] py-1.5 pl-2.5 pr-4">
                <span className="relative flex size-1.5">
                  <span className="pulse-ring absolute inline-flex size-full rounded-full bg-accent-400" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-accent-300" />
                </span>
                <span className="type-eyebrow text-accent-200">{kicker}</span>
              </span>
            </Reveal>
          ) : null}
          <Reveal delay={70}>
            <h1 className="type-display mt-7 text-ink-50">
              <span className="text-gradient-still">{title}</span>
            </h1>
          </Reveal>
          {lead ? (
            <Reveal delay={140}>
              <p className="type-lead mt-6 text-ink-400">{lead}</p>
            </Reveal>
          ) : null}
          {children ? (
            <Reveal delay={210} className="mt-8">
              {children}
            </Reveal>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function Section({
  children,
  className,
  mesh = false,
  id,
}: {
  children: ReactNode;
  className?: string;
  mesh?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn("relative border-t border-white/8 py-16 lg:py-24", className)}
    >
      {mesh ? (
        <div className="grid-mesh radial-fade absolute inset-0 opacity-60" aria-hidden="true" />
      ) : null}
      <div className="relative mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  );
}

export function SectionHeader({
  kicker,
  title,
  lead,
  align = "left",
  className,
}: {
  kicker?: string;
  title: string;
  lead?: string;
  align?: "left" | "center";
  className?: string;
}) {
  const centered = align === "center";
  return (
    <Reveal className={cn("max-w-2xl", centered && "mx-auto text-center", className)}>
      {kicker ? (
        <p
          className={cn(
            "type-eyebrow flex items-center gap-3 text-accent-400/90",
            centered && "justify-center",
          )}
        >
          <span aria-hidden="true" className="h-px w-8 bg-gradient-to-r from-accent-400/60 to-transparent" />
          {kicker}
        </p>
      ) : null}
      <h2 className="type-h2 mt-4 text-ink-50">{title}</h2>
      {lead ? <p className="type-lead mt-4 text-ink-400">{lead}</p> : null}
    </Reveal>
  );
}

/** Icon + title + body card used across About, Services and Developers. */
export function FeatureCard({
  icon,
  title,
  body,
  note,
  tone = "accent",
  className,
}: {
  icon: GlyphName;
  title: string;
  body: string;
  note?: string;
  tone?: "accent" | "neutral";
  className?: string;
}) {
  return (
    <div className={cn("panel spotlight h-full p-6", className)}>
      <span
        className={cn(
          "inline-flex size-11 items-center justify-center rounded-xl border transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          tone === "accent"
            ? "border-accent-400/25 bg-accent-500/10 text-accent-300"
            : "border-white/10 bg-white/5 text-ink-300",
        )}
      >
        <Glyph name={icon} className="size-5" />
      </span>
      <h3 className="mt-4 text-lg font-bold text-ink-50">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-400">{body}</p>
      {note ? (
        <p className="mt-4 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-xs leading-relaxed text-ink-400">
          {note}
        </p>
      ) : null}
    </div>
  );
}

/** Numbered process step with the home page's connector treatment. */
export function StepCard({
  index,
  total,
  icon,
  title,
  body,
}: {
  index: number;
  total: number;
  icon: GlyphName;
  title: string;
  body: string;
}) {
  return (
    <div className="panel relative h-full p-6">
      {index < total - 1 ? (
        <span
          className="absolute right-0 top-11 hidden h-px w-4 translate-x-full bg-gradient-to-r from-accent-400/40 to-transparent lg:block"
          aria-hidden="true"
        />
      ) : null}
      <div className="flex items-center gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-lg border border-accent-400/25 bg-accent-500/10 text-accent-300">
          <Glyph name={icon} className="size-5" />
        </span>
        <span className="font-mono text-xs font-semibold tracking-widest text-ink-500">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <h3 className="mt-4 font-bold text-ink-50">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-400">{body}</p>
    </div>
  );
}

/**
 * Plain-language disclosure block. Used wherever a page has to be explicit
 * about what the platform does NOT do — never styled as a warning, because
 * these are facts, not errors.
 */
export function DisclosureNote({
  title,
  children,
  icon = "shield",
}: {
  title: string;
  children: ReactNode;
  icon?: GlyphName;
}) {
  return (
    <div className="panel flex gap-4 p-6">
      <span className="hidden size-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-ink-300 sm:inline-flex">
        <Glyph name={icon} className="size-5" />
      </span>
      <div>
        <h3 className="font-bold text-ink-50">{title}</h3>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-400">{children}</div>
      </div>
    </div>
  );
}

export function CtaBand({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section className="grain relative overflow-hidden border-t border-white/8 py-20 lg:py-28">
      <div className="grid-mesh radial-fade absolute inset-0 opacity-50" aria-hidden="true" />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-500/10 blur-[110px]"
        aria-hidden="true"
      />
      <Reveal className="relative mx-auto max-w-2xl px-4 text-center sm:px-6">
        <h2 className="type-h2 text-ink-50">{title}</h2>
        {lead ? <p className="type-lead mt-4 text-ink-400">{lead}</p> : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">{children}</div>
      </Reveal>
    </section>
  );
}
