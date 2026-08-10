"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Custom cursor: a hard core dot that tracks the pointer exactly, plus a
 * trailing ring that eases toward it.
 *
 * Safety rules, in order of importance:
 *  - Mounts ONLY behind `(pointer: fine)` and only when reduced motion is off.
 *    On touch, hybrid tablets and for motion-sensitive visitors the native
 *    cursor is never hidden, because the `has-custom-cursor` class that hides
 *    it is added by this component and by nothing else. If the bundle fails to
 *    load, the page keeps a working cursor.
 *  - The core dot never lags. Only the ring is eased, so precision is
 *    unaffected while the trail supplies the sense of weight.
 *  - Over text inputs and code blocks the whole thing hides and the native
 *    caret returns (see globals.css) — people aim between characters there.
 *  - Purely decorative: `aria-hidden`, no focus, no pointer events. Keyboard
 *    users never see it and nothing about it is announced.
 *
 * Cost: two composited transforms per frame inside one rAF loop that stops
 * when the tab is hidden or the pointer leaves the window.
 */

type Mode = "default" | "action" | "view" | "text";

/** Elements that should enlarge the ring, and the label they announce. */
function resolveMode(target: Element | null): { mode: Mode; label: string } {
  if (!target) return { mode: "default", label: "" };

  const labelled = target.closest<HTMLElement>("[data-cursor]");
  if (labelled) {
    const value = labelled.dataset.cursor ?? "";
    // `data-cursor="view:VIEW"` → mode `view`, label `VIEW`.
    const [mode, label = ""] = value.split(":");
    if (mode === "view" || mode === "action" || mode === "text") {
      return { mode: mode as Mode, label: label.toUpperCase() };
    }
    return { mode: "view", label: value.toUpperCase() };
  }

  if (target.closest("input, textarea, select, [contenteditable='true'], pre, code")) {
    return { mode: "text", label: "" };
  }
  if (target.closest("a, button, [role='button'], label, summary")) {
    return { mode: "action", label: "" };
  }
  return { mode: "default", label: "" };
}

export function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<Mode>("default");
  const [label, setLabel] = useState("");
  const [visible, setVisible] = useState(false);
  const [pressed, setPressed] = useState(false);

  // Gate on capability first so nothing else in this component ever runs on a
  // device that should not have it.
  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setEnabled(fine.matches && !reduced.matches);
    sync();
    fine.addEventListener("change", sync);
    reduced.addEventListener("change", sync);
    return () => {
      fine.removeEventListener("change", sync);
      reduced.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    document.documentElement.classList.add("has-custom-cursor");
    return () => document.documentElement.classList.remove("has-custom-cursor");
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let px = window.innerWidth / 2;
    let py = window.innerHeight / 2;
    let rx = px;
    let ry = py;
    let raf = 0;
    let running = false;
    let lastMode: Mode = "default";
    let lastLabel = "";

    const tick = () => {
      // Critically-damped-ish follow. 0.2 keeps the ring close enough that it
      // never reads as a separate object drifting behind the dot.
      rx += (px - rx) * 0.2;
      ry += (py - ry) * 0.2;
      dot.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const onMove = (event: PointerEvent) => {
      px = event.clientX;
      py = event.clientY;
      if (!visible) setVisible(true);
      start();

      const next = resolveMode(event.target as Element | null);
      if (next.mode !== lastMode) {
        lastMode = next.mode;
        setMode(next.mode);
      }
      if (next.label !== lastLabel) {
        lastLabel = next.label;
        setLabel(next.label);
      }
    };

    const onLeave = () => {
      setVisible(false);
      stop();
    };
    const onEnter = () => {
      setVisible(true);
      start();
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("pointerenter", onEnter);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", () => setPressed(true), { passive: true });
    window.addEventListener("pointerup", () => setPressed(false), { passive: true });

    return () => {
      stop();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("pointerenter", onEnter);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // `visible` is intentionally excluded: re-subscribing on every show/hide
    // would tear down the rAF loop mid-move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (!enabled) return null;

  const hidden = mode === "text" || !visible;
  const ringSize = label ? 58 : mode === "action" ? 42 : mode === "view" ? 52 : 26;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[90]">
      <div
        ref={ringRef}
        className="fixed left-0 top-0 grid place-items-center rounded-full border transition-[width,height,opacity,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          width: ringSize,
          height: ringSize,
          opacity: hidden ? 0 : 1,
          borderColor: mode === "default" ? "rgba(203,213,225,0.45)" : "rgba(23,200,210,0.85)",
          backgroundColor: mode === "default" ? "transparent" : "rgba(23,200,210,0.10)",
          transform: "translate3d(-100px,-100px,0)",
        }}
      >
        {label ? (
          <span className="font-mono text-[9px] font-semibold tracking-[0.16em] text-accent-200">
            {label}
          </span>
        ) : null}
      </div>
      <div
        ref={dotRef}
        className="fixed left-0 top-0 rounded-full bg-accent-300 transition-[opacity,width,height] duration-200"
        style={{
          width: pressed ? 10 : 5,
          height: pressed ? 10 : 5,
          opacity: hidden || label ? 0 : 1,
          transform: "translate3d(-100px,-100px,0)",
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
}
