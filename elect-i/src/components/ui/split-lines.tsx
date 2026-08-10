"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Masked line reveal — the signature entrance for display headlines.
 *
 * Each line is wrapped in an overflow-hidden clip and rises into frame with a
 * stagger. Three constraints shaped the implementation:
 *
 *  1. The caller supplies the line breaks. Measuring wrapped text at runtime
 *     would mean splitting after layout, which flashes unstyled text and
 *     re-splits on every resize. Editorial control over where a headline
 *     breaks is worth more than automatic reflow here.
 *  2. The full string stays readable to crawlers and screen readers: the
 *     visible spans are aria-hidden and an sr-only copy carries the real text,
 *     so the headline is never announced as disconnected fragments.
 *  3. The hidden state is a class this component removes, not an animation
 *     end-state. A headline that only becomes visible once a CSS animation
 *     completes disappears entirely wherever the animation timeline is paused.
 *     See the note above `.reveal` in globals.css.
 */
export function SplitLines({
  lines,
  className,
  lineClassName,
  delay = 0,
  stagger = 90,
  as: Tag = "span",
}: {
  lines: string[];
  className?: string;
  /**
   * Applied to the INNER span, not the clip.
   *
   * This matters for gradient text: `background-clip: text` on the clip would
   * paint against the clip's own box, while the inner span is transformed into
   * its own layer — the text would render fully transparent. Styling the
   * element that actually holds the glyphs avoids that class of bug entirely.
   */
  lineClassName?: string;
  /** Delay before the first line starts, in ms. */
  delay?: number;
  /** Gap between consecutive lines, in ms. */
  stagger?: number;
  as?: "span" | "div";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const masks = Array.from(root.querySelectorAll<HTMLElement>(".line-mask"));
    const timers: number[] = [];

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined" ||
      // See the note in reveal.tsx: a hidden tab freezes the timeline, so a
      // headline gated on an entrance animation would never appear. Show it.
      document.visibilityState !== "visible"
    ) {
      for (const mask of masks) mask.classList.remove("is-armed");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const mask = entry.target as HTMLElement;
          observer.unobserve(mask);
          const index = masks.indexOf(mask);
          timers.push(
            window.setTimeout(
              () => {
                mask.classList.remove("is-armed");
                mask.classList.add("is-visible");
              },
              delay + Math.max(0, index) * stagger,
            ),
          );
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );
    for (const mask of masks) observer.observe(mask);

    return () => {
      observer.disconnect();
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [delay, stagger]);

  return (
    <Tag ref={ref as never} className={cn("block", className)}>
      <span className="sr-only">{lines.join(" ")}</span>
      {lines.map((line, i) => (
        <span key={`${line}-${i}`} aria-hidden="true" className="line-mask is-armed">
          <span className={lineClassName}>{line}</span>
        </span>
      ))}
    </Tag>
  );
}
