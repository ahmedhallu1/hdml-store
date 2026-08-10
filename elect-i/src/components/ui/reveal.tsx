"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Scroll reveal via IntersectionObserver rather than a scroll listener, so it
 * costs nothing on the main thread while idle.
 *
 * Content is present in the DOM from the first paint (crawlers and no-JS
 * visitors see everything); only opacity is animated.
 *
 * The element renders `is-armed` (opacity 0) and this effect removes it when
 * the element reaches the viewport, applying `is-visible` at the same moment
 * to play the entrance. Removing the hidden class — rather than relying on an
 * animation's fill mode to end at opacity 1 — is what keeps the page readable
 * in any environment where the animation timeline does not advance. See the
 * note above `.reveal` in globals.css.
 *
 * The stagger is a timer rather than an `animation-delay` for the same reason:
 * a delay would need `backwards` fill, which reintroduces the failure.
 */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  className,
  children,
}: {
  as?: ElementType;
  /** Stagger offset in ms. Keep under ~400ms so nothing feels slow. */
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const show = (animate: boolean) => {
      el.classList.remove("is-armed");
      if (animate) el.classList.add("is-visible");
    };

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined" ||
      // A background/hidden tab freezes the animation timeline at frame 0, which
      // would pin an entrance animation to its hidden start state indefinitely.
      // Screenshot services, link-preview renderers and prewarmed background
      // tabs all load hidden. In that case skip the animation and show content
      // immediately — a missing entrance is invisible; a frozen one hides the
      // page. A normally-loaded (visible) tab still gets the full reveal.
      document.visibilityState !== "visible"
    ) {
      show(false);
      return;
    }

    let timer = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          // One-shot: re-triggering on every scroll direction change is noise.
          observer.unobserve(entry.target);
          timer = window.setTimeout(() => show(true), delay);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [delay]);

  return (
    <Tag ref={ref} className={cn("reveal is-armed", className)}>
      {children}
    </Tag>
  );
}
