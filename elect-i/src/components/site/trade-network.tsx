"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * The hero's live trade network: a wireframe globe with great-circle lanes,
 * travelling consignment packets, pulsing destination rings and an orbital
 * data ring.
 *
 * Canvas 2D, no dependency. A WebGL/three.js scene would cost ~150KB gzipped
 * for what is ultimately line art on a sphere — the wrong trade for a Workers
 * deployment, and explicitly the kind of "large 3D dependency for a trivial
 * effect" worth avoiding. Everything here is ~8KB of code.
 *
 * Performance contract:
 *  - DPR capped at 2; particle and arc counts scale down under 640px.
 *  - The rAF loop stops entirely when the canvas leaves the viewport or the
 *    tab is hidden, so a scrolled-past hero costs nothing.
 *  - Pointer parallax and scroll offset are eased toward targets in the draw
 *    loop rather than driving their own frames.
 *  - Reduced motion renders exactly one static frame and never starts a loop.
 *
 * It is decorative and aria-hidden: every fact it alludes to (lane counts,
 * destinations, lead times) is also stated in text elsewhere on the page.
 */

interface Hub {
  /** Longitude/latitude in radians. */
  lon: number;
  lat: number;
  size: number;
  /** Sourcing origins glow warmer at the core; destinations pulse. */
  kind: "origin" | "destination";
}

// Rough positions of major sourcing and destination markets. Decorative only.
const HUBS: Hub[] = [
  { lon: 1.99, lat: 0.39, size: 3.0, kind: "origin" }, // Shenzhen
  { lon: 2.12, lat: 0.55, size: 2.4, kind: "origin" }, // Shanghai
  { lon: 1.81, lat: 0.02, size: 2.3, kind: "origin" }, // Singapore
  { lon: 0.96, lat: 0.44, size: 2.4, kind: "destination" }, // Dubai
  { lon: 0.55, lat: 0.53, size: 3.0, kind: "destination" }, // Cairo
  { lon: 0.0, lat: 0.9, size: 2.1, kind: "destination" }, // London
  { lon: 0.16, lat: 0.83, size: 1.9, kind: "destination" }, // Frankfurt
  { lon: -1.29, lat: 0.71, size: 2.3, kind: "destination" }, // New York
  { lon: -2.06, lat: 0.59, size: 1.9, kind: "destination" }, // Los Angeles
  { lon: -0.82, lat: -0.41, size: 1.9, kind: "destination" }, // São Paulo
  { lon: 2.44, lat: -0.59, size: 1.9, kind: "destination" }, // Sydney
  { lon: 1.35, lat: 0.33, size: 2.2, kind: "destination" }, // Mumbai
  { lon: 0.63, lat: 0.42, size: 2.0, kind: "destination" }, // Riyadh
  { lon: 0.5, lat: -0.02, size: 1.8, kind: "destination" }, // Nairobi
];

/** [originIndex, destinationIndex] — the lanes that carry packets. */
const LANES: Array<[number, number]> = [
  [0, 4], [0, 7], [0, 3], [0, 11], [0, 13],
  [1, 5], [1, 8], [1, 6],
  [2, 3], [2, 10], [2, 4],
  [0, 9], [1, 12], [2, 11],
];

const TAU = Math.PI * 2;

export function TradeNetwork({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let radius = 0;
    let raf = 0;
    let running = false;
    let rotation = 0;
    let compact = false;

    // Eased pointer parallax and scroll response.
    let tiltTargetX = 0;
    let tiltTargetY = 0;
    let tiltX = 0;
    let tiltY = 0;
    let scrollTarget = 0;
    let scrollEased = 0;

    const stars: Array<{ x: number; y: number; r: number; a: number; tw: number }> = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      compact = width < 560;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      radius = Math.min(width, height) * 0.36;

      stars.length = 0;
      const count = compact ? 26 : 64;
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: Math.random() * 1.1 + 0.25,
          a: Math.random() * 0.35 + 0.06,
          tw: Math.random() * TAU,
        });
      }
    };

    /** Project lon/lat (plus altitude multiplier) to screen. z < 0 is the far side. */
    const project = (lon: number, lat: number, alt = 1) => {
      const l = lon + rotation;
      const cosLat = Math.cos(lat);
      let x = cosLat * Math.sin(l);
      let y = Math.sin(lat);
      let z = cosLat * Math.cos(l);

      // Camera tilt: rotate the sphere rather than the canvas so the lighting
      // and depth test stay correct.
      const cx = Math.cos(tiltY);
      const sy = Math.sin(tiltY);
      const y2 = y * cx - z * sy;
      const z2 = y * sy + z * cx;
      y = y2;
      z = z2;

      const cz = Math.cos(tiltX);
      const sx = Math.sin(tiltX);
      const x2 = x * cz - z * sx;
      const z3 = x * sx + z * cz;
      x = x2;
      z = z3;

      const r = radius * alt;
      return { x: width / 2 + x * r, y: height / 2 - y * r, z };
    };

    /** Slerp between two unit vectors expressed as lon/lat. */
    const arcPoint = (a: Hub, b: Hub, t: number) => {
      const ax = Math.cos(a.lat) * Math.cos(a.lon);
      const ay = Math.sin(a.lat);
      const az = Math.cos(a.lat) * Math.sin(a.lon);
      const bx = Math.cos(b.lat) * Math.cos(b.lon);
      const by = Math.sin(b.lat);
      const bz = Math.cos(b.lat) * Math.sin(b.lon);

      const dot = Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz));
      const omega = Math.acos(dot);
      const sinOmega = Math.sin(omega) || 1e-6;
      const s1 = Math.sin((1 - t) * omega) / sinOmega;
      const s2 = Math.sin(t * omega) / sinOmega;

      const x = ax * s1 + bx * s2;
      const y = ay * s1 + by * s2;
      const z = az * s1 + bz * s2;
      const len = Math.hypot(x, y, z) || 1;

      const lat = Math.asin(y / len);
      const lon = Math.atan2(z / len, x / len);
      // Lift the middle of the lane off the surface.
      const alt = 1 + Math.sin(Math.PI * t) * (0.1 + omega * 0.075);
      return { lon, lat, alt };
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      if (radius <= 0) return;

      tiltX += (tiltTargetX - tiltX) * 0.06;
      tiltY += (tiltTargetY - tiltY) * 0.06;
      scrollEased += (scrollTarget - scrollEased) * 0.08;

      const cx = width / 2;
      const cy = height / 2;

      // ── Starfield ───────────────────────────────────────────────────────
      for (const star of stars) {
        const twinkle = 0.6 + Math.sin(time * 0.0008 + star.tw) * 0.4;
        ctx.globalAlpha = star.a * twinkle;
        ctx.fillStyle = "#9fe8ee";
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ── Atmosphere ──────────────────────────────────────────────────────
      const halo = ctx.createRadialGradient(cx, cy, radius * 0.72, cx, cy, radius * 1.5);
      halo.addColorStop(0, "rgba(6,166,180,0.16)");
      halo.addColorStop(0.55, "rgba(6,166,180,0.05)");
      halo.addColorStop(1, "rgba(6,166,180,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.5, 0, TAU);
      ctx.fill();

      // Globe body: a very dark sphere so far-side lines read as "behind".
      const body = ctx.createRadialGradient(
        cx - radius * 0.35,
        cy - radius * 0.4,
        radius * 0.1,
        cx,
        cy,
        radius,
      );
      body.addColorStop(0, "rgba(18,40,52,0.55)");
      body.addColorStop(1, "rgba(5,10,16,0.85)");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, TAU);
      ctx.fill();

      // ── Graticule ───────────────────────────────────────────────────────
      const strokeGraticule = (points: Array<{ x: number; y: number; z: number }>) => {
        let started = false;
        ctx.beginPath();
        for (const p of points) {
          if (p.z < 0) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      };

      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(23,200,210,0.11)";
      const meridians = compact ? 8 : 14;
      for (let i = 0; i < meridians; i++) {
        const lon = (i / meridians) * TAU;
        const pts = [];
        for (let j = 0; j <= 44; j++) {
          pts.push(project(lon, -Math.PI / 2 + (j / 44) * Math.PI));
        }
        strokeGraticule(pts);
      }
      for (let i = 1; i < 7; i++) {
        const lat = -Math.PI / 2 + (i / 7) * Math.PI;
        const pts = [];
        for (let j = 0; j <= 60; j++) pts.push(project((j / 60) * TAU, lat));
        strokeGraticule(pts);
      }

      // Rim light: the terminator that sells it as a sphere rather than a disc.
      ctx.strokeStyle = "rgba(69,223,228,0.4)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, TAU);
      ctx.stroke();

      // ── Orbital data ring ───────────────────────────────────────────────
      if (!compact) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.42);
        ctx.scale(1, 0.24);
        ctx.strokeStyle = "rgba(23,200,210,0.22)";
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 12]);
        ctx.lineDashOffset = -time * 0.02;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.28, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // ── Lanes ───────────────────────────────────────────────────────────
      const laneCount = compact ? 6 : LANES.length;
      for (let li = 0; li < laneCount; li++) {
        const [ai, bi] = LANES[li];
        const a = HUBS[ai];
        const b = HUBS[bi];

        const steps = compact ? 26 : 42;
        const pts: Array<{ x: number; y: number; z: number }> = [];
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const { lon, lat, alt } = arcPoint(a, b, t);
          pts.push(project(lon, lat, alt));
        }

        // Draw front-facing segments only, so lanes pass behind the globe.
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = "rgba(69,223,228,0.3)";
        let started = false;
        ctx.beginPath();
        for (const p of pts) {
          if (p.z < -0.02) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        // Consignment packet with a short comet tail.
        const speed = 0.00006 + (li % 4) * 0.000018;
        const progress = ((time * speed + li * 0.19) % 1 + 1) % 1;
        const head = Math.floor(progress * steps);
        const p = pts[head];
        if (p && p.z >= 0) {
          ctx.globalCompositeOperation = "lighter";
          for (let t = 0; t < 6; t++) {
            const q = pts[Math.max(0, head - t)];
            if (!q || q.z < 0) continue;
            ctx.globalAlpha = (1 - t / 6) * 0.5;
            ctx.fillStyle = "#86edef";
            ctx.beginPath();
            ctx.arc(q.x, q.y, 1.7 - t * 0.18, 0, TAU);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#e6fbfb";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.1, 0, TAU);
          ctx.fill();
          ctx.globalCompositeOperation = "source-over";
        }
      }

      // ── Hubs ────────────────────────────────────────────────────────────
      for (let hi = 0; hi < HUBS.length; hi++) {
        const hub = HUBS[hi];
        const p = project(hub.lon, hub.lat);
        if (p.z < 0) continue;
        // Fade toward the limb so nodes do not pop at the edge.
        const depth = Math.min(1, p.z * 1.9);

        if (hub.kind === "destination") {
          const phase = ((time * 0.00042 + hi * 0.27) % 1 + 1) % 1;
          ctx.globalAlpha = (1 - phase) * 0.5 * depth;
          ctx.strokeStyle = "#45dfe4";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, hub.size + phase * 16, 0, TAU);
          ctx.stroke();
        }

        ctx.globalAlpha = depth;
        ctx.fillStyle = hub.kind === "origin" ? "#e6fbfb" : "#45dfe4";
        ctx.beginPath();
        ctx.arc(p.x, p.y, hub.size * 0.62, 0, TAU);
        ctx.fill();

        ctx.globalAlpha = depth * 0.35;
        ctx.beginPath();
        ctx.arc(p.x, p.y, hub.size * 1.6, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const frame = (time: number) => {
      draw(time);
      rotation += 0.00085 + scrollEased * 0.0022;
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running || reduced) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const onPointerMove = (event: PointerEvent) => {
      // Normalised to ±1 across the viewport, then scaled to a subtle tilt.
      tiltTargetX = (event.clientX / window.innerWidth - 0.5) * 0.5;
      tiltTargetY = (event.clientY / window.innerHeight - 0.5) * -0.34;
    };
    const onScroll = () => {
      const rect = canvas.getBoundingClientRect();
      scrollTarget = Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height)));
    };

    resize();
    onScroll();

    // Only run while on screen.
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) start();
          else stop();
        }
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) requestAnimationFrame((t) => draw(t));
    });
    ro.observe(canvas);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    if (!reduced) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    if (reduced) {
      // One composed frame, no loop: the scene still reads as a globe with
      // lanes, it simply never moves.
      requestAnimationFrame((t) => draw(t));
    }

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("block size-full", className)}
    />
  );
}
