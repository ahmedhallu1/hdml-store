import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/ui/icon";

/**
 * Branded placeholder for products that ship without a photo — which is most
 * mirrored rows.
 *
 * Design intent: it must read as an intentional "image pending" emblem, never
 * as a broken or misleading product picture. So there is no attempt to *draw*
 * the product (an earlier version drew a shirt for a work boot, which looked
 * broken). Instead each of the eight catalogue groups gets its clean line icon
 * inside the brand hexagon — clearly a category badge — over a blueprint grid,
 * with a per-SKU accent tint so a grid of placeholders still reads as distinct
 * cards. The label is the product's real category name, not jargon.
 */

const GROUP_ICON: Record<string, IconName> = {
  electronics: "cpu",
  industrial: "factory",
  home: "home",
  fashion: "shirt",
  office: "briefcase",
  automotive: "car",
  medical: "flask",
  other: "package",
};

/** FNV-1a-ish hash → stable 0..1, used only for decorative variation. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export function ProductVisual({
  groupKey,
  sku,
  label,
  className,
}: {
  groupKey: string | null | undefined;
  sku: string;
  /** The product's real category name — shown as the badge caption. */
  label?: string | null;
  className?: string;
}) {
  const key = groupKey && groupKey in GROUP_ICON ? groupKey : "other";
  const icon = GROUP_ICON[key];
  const seed = hash(sku || key);
  // Hue drifts only within the cyan-teal band (176°–196°) so it stays on-brand.
  const hue = Math.round(176 + seed * 20);
  const ref = `${key.slice(0, 3).toUpperCase()}-${Math.floor(seed * 9000 + 1000)}`;
  const accent = `hsl(${hue} 82% 66%)`;

  return (
    <div
      className={cn(
        "relative aspect-square w-full select-none overflow-hidden rounded-[calc(var(--radius-card)-1px)] bg-gradient-to-br from-obsidian-700/80 to-obsidian-800",
        className,
      )}
      aria-hidden="true"
    >
      {/* Blueprint grid + per-SKU glow. */}
      <div className="grid-mesh-fine absolute inset-0 opacity-60" />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(58% 48% at 50% 42%, hsl(${hue} 75% 45% / 0.20), transparent 72%)`,
        }}
      />

      {/* Corner registration ticks — the technical tell. */}
      <svg viewBox="0 0 120 120" className="absolute inset-0 size-full" preserveAspectRatio="none">
        <g stroke="rgba(255,255,255,0.16)" strokeWidth="1" fill="none">
          <path d="M8 15V8h7M112 15V8h-7M8 105v7h7M112 105v7h-7" />
        </g>
      </svg>

      {/* Brand hexagon emblem with the category glyph inside. */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative grid size-[42%] place-items-center">
          <svg viewBox="0 0 48 48" className="absolute inset-0 size-full" fill="none">
            <path
              d="M24 2.6 41.4 12.7v20.6L24 43.4 6.6 33.3V12.7Z"
              stroke={accent}
              strokeOpacity="0.55"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path
              d="M24 2.6 41.4 12.7v20.6L24 43.4 6.6 33.3V12.7Z"
              fill={accent}
              fillOpacity="0.06"
            />
          </svg>
          <span
            className="relative grid size-1/2 place-items-center"
            style={{ color: accent }}
          >
            <Icon name={icon} className="size-full" />
          </span>
        </div>
      </div>

      {/* Real category caption + deterministic reference — no jargon. */}
      <div className="absolute inset-x-3 bottom-2.5 flex items-center justify-between gap-2">
        {label ? (
          <span className="truncate text-[10px] font-medium uppercase tracking-wider text-ink-500">
            {label}
          </span>
        ) : (
          <span />
        )}
        <span className="shrink-0 font-mono text-[9px] tracking-wider text-ink-700">{ref}</span>
      </div>
    </div>
  );
}
