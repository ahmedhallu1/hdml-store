import { cn } from "@/lib/cn";

/**
 * HDML-branded placeholder art shown until real product photos are supplied.
 * One simple line icon per category on a soft teal tile — deliberately
 * abstract so it can never be mistaken for an actual product photo.
 */

const ICON_PATHS: Record<string, React.ReactNode> = {
  case: <rect x="15" y="8" width="18" height="32" rx="4" />,
  charger: (
    <>
      <rect x="14" y="18" width="20" height="16" rx="3" />
      <path d="M20 18v-6m8 6v-6M24 34v6" />
    </>
  ),
  earbuds: (
    <>
      <path d="M17 14a6 6 0 0 1 6 6v4a3 3 0 0 1-6 0V20" />
      <path d="M31 14a6 6 0 0 0-6 6v4a3 3 0 0 0 6 0V20" />
      <path d="M17 14v14m14-14v14" />
    </>
  ),
  cable: <path d="M12 36c10 0 6-24 16-24 6 0 8 5 8 8M12 36h6m-6 0v-6" />,
  keyboard: (
    <>
      <rect x="8" y="16" width="32" height="18" rx="3" />
      <path d="M13 22h2m4 0h2m4 0h2m4 0h2m4 0h2M15 28h18" />
    </>
  ),
  speaker: (
    <>
      <rect x="14" y="8" width="20" height="32" rx="4" />
      <circle cx="24" cy="28" r="6" />
      <circle cx="24" cy="15" r="2" />
    </>
  ),
  storage: (
    <>
      <rect x="10" y="14" width="28" height="20" rx="3" />
      <path d="M32 14v20M14 20h10m-10 5h10" />
    </>
  ),
  phone: (
    <>
      <rect x="15" y="8" width="18" height="32" rx="4" />
      <path d="M21 36h6" />
    </>
  ),
  router: (
    <>
      <rect x="10" y="26" width="28" height="10" rx="3" />
      <path d="M16 26V14m16 12v-8M15 31h.5m4.5 0h.5" />
    </>
  ),
  tablet: (
    <>
      <rect x="11" y="8" width="26" height="32" rx="4" />
      <path d="M22 35h4" />
    </>
  ),
  computer: (
    <>
      <rect x="8" y="10" width="32" height="20" rx="3" />
      <path d="M18 38h12m-6-8v8" />
    </>
  ),
  watch: (
    <>
      <rect x="16" y="14" width="16" height="20" rx="5" />
      <path d="M20 14l1-6h6l1 6m-8 20l1 6h6l1-6" />
    </>
  ),
  camera: (
    <>
      <rect x="8" y="14" width="32" height="22" rx="4" />
      <circle cx="24" cy="25" r="7" />
      <path d="M16 14l2-4h12l2 4" />
    </>
  ),
  tv: (
    <>
      <rect x="8" y="10" width="32" height="22" rx="3" />
      <path d="M16 38h16m-8-6v6" />
    </>
  ),
  gamepad: (
    <>
      <path d="M14 16h20a8 8 0 0 1 8 8c0 5-3 9-7 9-3 0-4-3-6-3H19c-2 0-3 3-6 3-4 0-7-4-7-9a8 8 0 0 1 8-8Z" />
      <path d="M16 22v6m-3-3h6m10 -1h.5m4.5 2h.5" />
    </>
  ),
  battery: (
    <>
      <rect x="8" y="16" width="28" height="16" rx="3" />
      <path d="M40 22v4M14 22l4 4-4 0 4 4" />
    </>
  ),
  smarthome: (
    <>
      <path d="M10 22 24 10l14 12" />
      <path d="M14 20v16h20V20" />
      <circle cx="24" cy="28" r="4" />
    </>
  ),
  bag: (
    <>
      <path d="M14 18h20l-2 20H16l-2-20Z" />
      <path d="M18 18a6 6 0 0 1 12 0" />
    </>
  ),
  box: (
    <>
      <path d="M8 16 24 8l16 8-16 8-16-8Z" />
      <path d="M8 16v16l16 8 16-8V16M24 24v16" />
    </>
  ),
};

export function ProductPlaceholder({
  icon,
  className,
  label,
}: {
  icon?: string | null;
  className?: string;
  label?: string;
}) {
  const path = ICON_PATHS[icon ?? "box"] ?? ICON_PATHS.box;
  return (
    <div
      role="img"
      aria-label={label ? `${label} — image coming soon` : "Product image coming soon"}
      className={cn(
        "flex aspect-square w-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-2">
        <svg
          viewBox="0 0 48 48"
          className="size-1/3 min-h-10 min-w-10 max-w-20 text-brand-300"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {path}
        </svg>
        <span className="select-none text-[10px] font-semibold uppercase tracking-widest text-brand-300">
          HDML
        </span>
      </div>
    </div>
  );
}
