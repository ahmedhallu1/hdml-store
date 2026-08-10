"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * A hairline progress bar for cross-page navigation.
 *
 * Server-rendered routes in this app do real work before they stream (auth,
 * Supabase queries), so a click can sit for a few hundred ms with no feedback.
 * This gives the click an immediate acknowledgement.
 *
 * It listens for same-origin anchor clicks rather than wrapping the router, so
 * it works with every existing <Link> without touching them. The bar animates
 * toward — but never reaches — 100% while pending, then completes when the
 * pathname actually changes.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Let the browser handle anything that is not a plain left click.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page, or a pure hash jump — nothing to wait for.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      setDone(false);
      setPending(true);
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  // The new route committed (pathname changed): snap the bar to full and fade
  // it out. State is flipped inside async callbacks, never synchronously in the
  // effect body, so this never triggers a cascading render.
  useEffect(() => {
    if (!pending) return;
    const raf = requestAnimationFrame(() => {
      setPending(false);
      setDone(true);
    });
    const timer = window.setTimeout(() => setDone(false), 460);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!pending && !done) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden"
    >
      <div
        className="h-full origin-left bg-gradient-to-r from-accent-500 via-accent-300 to-accent-500 shadow-[0_0_12px_rgba(23,200,210,0.8)]"
        style={
          done
            ? { transform: "scaleX(1)", transition: "transform 200ms var(--ease-out-expo), opacity 220ms 180ms", opacity: 0 }
            : { animation: "progress-crawl 2.4s var(--ease-out-expo) forwards" }
        }
      />
    </div>
  );
}
