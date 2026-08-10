import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Reveal } from "@/components/ui/reveal";

/**
 * The standard section opening: a numbered technical eyebrow, a display
 * heading and a lead paragraph.
 *
 * The eyebrow index is what gives the marketing pages their instrument-panel
 * rhythm — every section is a labelled station rather than another block of
 * copy, which is also why it is rendered as decorative text rather than
 * folded into the heading.
 */
export function SectionHead({
  index,
  eyebrow,
  title,
  lead,
  align = "start",
  className,
  children,
}: {
  /** Two-digit station number, e.g. "02". */
  index?: string;
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "start" | "center";
  className?: string;
  children?: ReactNode;
}) {
  const centered = align === "center";
  return (
    <div className={cn(centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl", className)}>
      {eyebrow ? (
        <Reveal>
          <p
            className={cn(
              "type-eyebrow flex items-center gap-3 text-accent-400/90",
              centered && "justify-center",
            )}
          >
            {index ? <span className="text-ink-700">{index}</span> : null}
            <span
              aria-hidden="true"
              className="h-px w-8 bg-gradient-to-r from-accent-400/60 to-transparent"
            />
            {eyebrow}
          </p>
        </Reveal>
      ) : null}
      <Reveal delay={70}>
        <h2 className="type-h2 mt-5 text-ink-50">{title}</h2>
      </Reveal>
      {lead ? (
        <Reveal delay={130}>
          <p className="type-lead mt-5 text-ink-400">{lead}</p>
        </Reveal>
      ) : null}
      {children}
    </div>
  );
}
