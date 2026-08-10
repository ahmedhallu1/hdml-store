"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Magnetic hover: the child drifts a few pixels toward the pointer as it
 * approaches, then springs back on leave.
 *
 * Applied to primary CTAs only. The pull is small (max ~9px) and the element's
 * hit area is unchanged, so nothing becomes harder to click — the effect reads
 * as responsiveness, not as a moving target.
 *
 * Disabled outright on coarse pointers (there is no hover to anticipate) and
 * for reduced-motion visitors.
 */
export function Magnetic({
  children,
  className,
  /** Maximum displacement in px. */
  strength = 9,
  /** How far outside the element the field extends, in px. */
  radius = 46,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
  radius?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const child = el.firstElementChild as HTMLElement | null;
    if (!child) return;

    let frame = 0;

    const reset = () => {
      child.style.transition = "transform 520ms var(--ease-spring)";
      child.style.transform = "translate3d(0,0,0)";
    };

    const onMove = (event: PointerEvent) => {
      // One rect read per frame, never inside the write path.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = event.clientX - cx;
        const dy = event.clientY - cy;
        const reach = Math.max(rect.width, rect.height) / 2 + radius;
        const distance = Math.hypot(dx, dy);

        if (distance > reach) {
          reset();
          return;
        }
        const pull = (1 - distance / reach) * strength;
        const angle = Math.atan2(dy, dx);
        child.style.transition = "transform 180ms var(--ease-out-expo)";
        child.style.transform = `translate3d(${Math.cos(angle) * pull}px, ${Math.sin(angle) * pull}px, 0)`;
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [radius, strength]);

  return (
    <span ref={ref} className={cn("inline-flex", className)}>
      {children}
    </span>
  );
}
