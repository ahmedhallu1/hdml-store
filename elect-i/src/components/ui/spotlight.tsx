"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Publishes the pointer position onto a container as `--mx` / `--my`
 * percentages so any descendant with `.spotlight` can render a cursor-tracking
 * rim light purely in CSS.
 *
 * One listener on the container covers a whole grid of cards, which is why the
 * handler lives here and not on each card: 24 catalog cards would otherwise
 * mean 24 pointermove listeners. Writes are batched into a frame and only ever
 * touch custom properties, so nothing invalidates layout.
 */
export function SpotlightGroup({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let frame = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // The lit card is whichever `.spotlight` is under the pointer.
        const target = (event.target as Element | null)?.closest<HTMLElement>(".spotlight");
        if (!target) return;
        const rect = target.getBoundingClientRect();
        target.style.setProperty("--mx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
        target.style.setProperty("--my", `${((event.clientY - rect.top) / rect.height) * 100}%`);
      });
    };

    root.addEventListener("pointermove", onMove as EventListener, { passive: true });
    return () => {
      root.removeEventListener("pointermove", onMove as EventListener);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <Tag ref={ref} className={cn(className)}>
      {children}
    </Tag>
  );
}
