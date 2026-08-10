import type { CSSProperties } from "react";

/**
 * Edge-masked marquee. The track is duplicated once and translated -50%, so
 * the loop is seamless. Under prefers-reduced-motion globals.css collapses the
 * animation and the strip simply sits still — nothing is lost, because the
 * duplicated half is aria-hidden and the first half is fully readable.
 */
export function Marquee({
  items,
  durationSeconds = 45,
}: {
  items: string[];
  durationSeconds?: number;
}) {
  return (
    <div className="marquee-mask overflow-hidden">
      <ul
        className="marquee-track flex w-max gap-3"
        style={{ "--marquee-duration": `${durationSeconds}s` } as CSSProperties}
      >
        {items.map((item) => (
          <Chip key={`a-${item}`} label={item} />
        ))}
        {items.map((item) => (
          <Chip key={`b-${item}`} label={item} hidden />
        ))}
      </ul>
    </div>
  );
}

function Chip({ label, hidden = false }: { label: string; hidden?: boolean }) {
  return (
    <li
      aria-hidden={hidden || undefined}
      className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-ink-300"
    >
      {label}
    </li>
  );
}
