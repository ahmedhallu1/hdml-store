"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Scroll-responsive chrome for the header.
 *
 * At the top of a page the bar is transparent and full height so the hero can
 * bleed under it. Past ~24px it condenses: shorter, darker, blurred, with a
 * lit hairline. The two states are pure CSS transitions on a class, so the
 * scroll handler only ever flips a boolean.
 *
 * The height change is applied to an inner row rather than the <header> so the
 * sticky element's own box never resizes — otherwise the page would jump by
 * the delta at the exact moment the class flips.
 */
export function HeaderShell({ children }: { children: ReactNode }) {
  const [condensed, setCondensed] = useState(false);
  const ticking = useRef(false);

  useEffect(() => {
    const update = () => {
      setCondensed(window.scrollY > 24);
      ticking.current = false;
    };
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        condensed
          ? "border-b border-white/10 bg-obsidian-950/80 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      {/* Lit hairline that fades in with the condensed state. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent-400/40 to-transparent transition-opacity duration-500",
          condensed ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className={cn(
          "mx-auto flex max-w-[92rem] items-center gap-3 px-4 transition-[height] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:px-6 lg:px-8",
          condensed ? "h-14" : "h-[4.5rem]",
        )}
      >
        {children}
      </div>
    </header>
  );
}
