"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Count-up statistic. The final value is rendered on the server and remains
 * the text content until the element scrolls into view, so the real number is
 * always in the DOM for crawlers, screen readers and no-JS visitors.
 */
export function Counter({
  to,
  suffix = "",
  prefix = "",
  duration = 1600,
  decimals = 0,
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(to);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();
        setAnimating(true);

        const start = performance.now();
        let frame = 0;
        const tick = (now: number) => {
          // Clamp progress to [0,1]. A background/throttled tab can hand rAF a
          // timestamp fractionally BEFORE `start` (timer-clamping skew); without
          // the lower clamp that makes `t` negative, easeOutExpo exceed 1, and
          // the counter flash a negative number for a frame.
          const t = Math.min(Math.max((now - start) / duration, 0), 1);
          // easeOutExpo — fast start, long settle.
          const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
          setValue(to * eased);
          if (t < 1) frame = requestAnimationFrame(tick);
          else setAnimating(false);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
      },
      { threshold: 0.4 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [to, duration]);

  const shown = animating
    ? value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : to.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {shown}
      {suffix}
    </span>
  );
}
