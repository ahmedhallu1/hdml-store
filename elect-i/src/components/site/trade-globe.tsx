"use client";

import { useEffect, useRef } from "react";

/**
 * Animated trade-lane globe behind the hero.
 *
 * Canvas 2D rather than WebGL/three.js: the whole effect is ~4KB of code with
 * no dependency, which matters on a Workers free tier. It is purely
 * decorative and marked aria-hidden, so it carries no information that is
 * lost when it does not render.
 *
 * Cost controls: DPR capped at 2, the loop stops entirely when the canvas
 * scrolls out of view or the tab is hidden, and reduced-motion visitors get a
 * single static frame.
 */

interface Hub {
  /** Longitude/latitude in radians. */
  lon: number;
  lat: number;
  size: number;
}

// Rough positions of major sourcing and destination markets. Decorative only.
const HUBS: Hub[] = [
  { lon: 1.99, lat: 0.39, size: 2.6 }, // Shenzhen
  { lon: 2.12, lat: 0.55, size: 2.0 }, // Shanghai
  { lon: 1.81, lat: 0.02, size: 2.2 }, // Singapore
  { lon: 0.96, lat: 0.44, size: 2.0 }, // Dubai
  { lon: 0.55, lat: 0.53, size: 2.4 }, // Cairo
  { lon: 0.0, lat: 0.9, size: 2.0 }, // London
  { lon: 0.16, lat: 0.83, size: 1.8 }, // Frankfurt
  { lon: -1.29, lat: 0.71, size: 2.2 }, // New York
  { lon: -2.06, lat: 0.59, size: 1.8 }, // Los Angeles
  { lon: -0.82, lat: -0.41, size: 1.8 }, // São Paulo
  { lon: 2.44, lat: -0.59, size: 1.8 }, // Sydney
  { lon: 1.35, lat: 0.33, size: 2.0 }, // Mumbai
];

const LANES: Array<[number, number]> = [
  [0, 4], [0, 7], [0, 3], [0, 11], [1, 5], [1, 8],
  [2, 3], [3, 4], [4, 5], [6, 4], [7, 9], [10, 0], [11, 3],
];

export function TradeGlobe({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let radius = 0;
    let frame = 0;
    let rotation = 0;
    let running = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      radius = Math.min(width, height) * 0.38;
    };

    /** Project a lon/lat onto the 2D canvas; z < 0 is the far side. */
    const project = (lon: number, lat: number) => {
      const l = lon + rotation;
      const x = Math.cos(lat) * Math.sin(l);
      const y = Math.sin(lat);
      const z = Math.cos(lat) * Math.cos(l);
      return { x: width / 2 + x * radius, y: height / 2 - y * radius, z };
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;

      // Meridians and parallels.
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const lon = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        let started = false;
        for (let j = 0; j <= 48; j++) {
          const lat = -Math.PI / 2 + (j / 48) * Math.PI;
          const p = project(lon, lat);
          if (p.z < 0) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = "rgba(23,200,210,0.10)";
        ctx.stroke();
      }
      for (let i = 1; i < 6; i++) {
        const lat = -Math.PI / 2 + (i / 6) * Math.PI;
        ctx.beginPath();
        let started = false;
        for (let j = 0; j <= 64; j++) {
          const lon = (j / 64) * Math.PI * 2;
          const p = project(lon, lat);
          if (p.z < 0) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = "rgba(23,200,210,0.08)";
        ctx.stroke();
      }

      // Limb glow.
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(69,223,228,0.22)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Trade lanes: quadratic arcs that lift off the sphere.
      LANES.forEach(([a, b], index) => {
        const pa = project(HUBS[a].lon, HUBS[a].lat);
        const pb = project(HUBS[b].lon, HUBS[b].lat);
        if (pa.z < -0.15 && pb.z < -0.15) return;

        const mx = (pa.x + pb.x) / 2;
        const my = (pa.y + pb.y) / 2;
        const dx = mx - cx;
        const dy = my - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const lift = 1 + (Math.hypot(pb.x - pa.x, pb.y - pa.y) / radius) * 0.28;
        const qx = cx + (dx / dist) * dist * lift;
        const qy = cy + (dy / dist) * dist * lift;

        const depth = Math.max(0, (pa.z + pb.z) / 2 + 0.4);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.quadraticCurveTo(qx, qy, pb.x, pb.y);
        ctx.strokeStyle = `rgba(6,166,180,${0.1 + depth * 0.2})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // A packet travelling the lane, offset per lane so they never sync up.
        const t = (((time / 3400 + index * 0.17) % 1) + 1) % 1;
        const it = 1 - t;
        const px = it * it * pa.x + 2 * it * t * qx + t * t * pb.x;
        const py = it * it * pa.y + 2 * it * t * qy + t * t * pb.y;
        const alpha = Math.sin(t * Math.PI) * (0.35 + depth * 0.5);
        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(134,237,239,${alpha})`;
        ctx.fill();
      });

      // Hubs, sorted so near-side nodes draw last.
      HUBS.map((h) => ({ h, p: project(h.lon, h.lat) }))
        .sort((m, n) => m.p.z - n.p.z)
        .forEach(({ h, p }) => {
          if (p.z < -0.1) return;
          const near = Math.max(0, p.z);
          ctx.beginPath();
          ctx.arc(p.x, p.y, h.size * (0.55 + near * 0.6), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(69,223,228,${0.35 + near * 0.55})`;
          ctx.fill();

          if (near > 0.35) {
            // JS `%` keeps the dividend's sign, and several hub longitudes are
            // negative — a raw modulo would make `pulse` negative and hand
            // arc() a negative radius. Normalise into [0, 1).
            const pulse = (((time / 2000 + h.lon) % 1) + 1) % 1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, h.size + pulse * 13, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(23,200,210,${(1 - pulse) * 0.28 * near})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
    };

    const loop = (time: number) => {
      if (!running) return;
      rotation += 0.0011;
      draw(time);
      frame = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running || reduced) return;
      running = true;
      frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    resize();
    draw(0);

    // Only animate while actually on screen and the tab is focused.
    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting && !document.hidden ? start() : stop()),
      { threshold: 0.01 },
    );
    observer.observe(canvas);

    const onVisibility = () => (document.hidden ? stop() : start());
    const onResize = () => {
      resize();
      draw(performance.now());
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
