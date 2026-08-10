import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/**
 * Marketing icon set. Extends the shared 24px stroke grid in
 * `components/ui/icon.tsx` with the glyphs the marketing and legal pages need,
 * without editing the shared kit. Emoji are never used as icons.
 */
export type ExtraGlyphName =
  | "file-text"
  | "clipboard"
  | "users"
  | "scale"
  | "lock"
  | "layers"
  | "tag"
  | "chart"
  | "key"
  | "webhook"
  | "credit-card"
  | "refresh"
  | "alert"
  | "clock"
  | "mail"
  | "phone"
  | "plane"
  | "ship"
  | "message"
  | "building";

export type GlyphName = IconName | ExtraGlyphName;

const EXTRA: Record<ExtraGlyphName, React.ReactNode> = {
  "file-text": (
    <>
      <path d="M14 2.5H7A2.5 2.5 0 0 0 4.5 5v14A2.5 2.5 0 0 0 7 21.5h10a2.5 2.5 0 0 0 2.5-2.5V8z" />
      <path d="M13.8 2.6V8h5.6M8.5 13h7M8.5 17h5" />
    </>
  ),
  clipboard: (
    <>
      <rect x="4.5" y="4.5" width="15" height="17" rx="2.5" />
      <path d="M9 4.8v-1a1.3 1.3 0 0 1 1.3-1.3h3.4A1.3 1.3 0 0 1 15 3.8v1z" />
      <path d="M8.5 11h7M8.5 15.5h4.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.6" />
      <path d="M2.6 20.5a6.4 6.4 0 0 1 12.8 0" />
      <path d="M16.2 4.9a3.6 3.6 0 0 1 0 6.2M17.6 14.7a6.4 6.4 0 0 1 3.8 5.8" />
    </>
  ),
  scale: (
    <>
      <path d="M12 4v16.5M7 20.5h10M4 8.4 12 6l8 2.4" />
      <path d="m4 8.4-2.4 5.1a2.7 2.7 0 0 0 4.8 0zM20 8.4l-2.4 5.1a2.7 2.7 0 0 0 4.8 0z" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="11.5" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14.5v2.5" />
    </>
  ),
  layers: (
    <>
      <path d="m12 2.8 8.6 4.4-8.6 4.4-8.6-4.4z" />
      <path d="m3.4 12 8.6 4.4 8.6-4.4M3.4 16.6 12 21l8.6-4.4" />
    </>
  ),
  tag: (
    <>
      <path d="M20.6 12.6 13 20.2a2 2 0 0 1-2.8 0l-6.6-6.6a2 2 0 0 1-.6-1.4V4.6a2 2 0 0 1 2-2h7.6a2 2 0 0 1 1.4.6l6.6 6.6a2 2 0 0 1 0 2.8z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  chart: (
    <>
      <path d="M3.5 3v18h17" />
      <path d="M7.5 17v-4M11.5 17v-8M15.5 17v-5M19.5 17v-9.5" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="12" r="4.2" />
      <path d="M11.7 12h9M17.5 12v3.4M20.7 12v2.4" />
    </>
  ),
  webhook: (
    <>
      <path d="M9 2.8v6.4M15 2.8v6.4" />
      <path d="M6.4 9.2h11.2v3.6a5.6 5.6 0 0 1-11.2 0z" />
      <path d="M12 18.4v2.8" />
    </>
  ),
  "credit-card": (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.8h19M6.2 14.8h3.4" />
    </>
  ),
  refresh: (
    <>
      <path d="M20.4 12a8.4 8.4 0 1 1-2.6-6.1" />
      <path d="M20.6 3.4v5.4h-5.4" />
    </>
  ),
  alert: (
    <>
      <path d="M10.6 3.6a1.6 1.6 0 0 1 2.8 0l7.5 13.6a1.6 1.6 0 0 1-1.4 2.4H4.5a1.6 1.6 0 0 1-1.4-2.4z" />
      <path d="M12 9v4.3M12 16.4v.4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 6.4V12l3.6 2.4" />
    </>
  ),
  mail: (
    <>
      <rect x="2.5" y="4.8" width="19" height="14.4" rx="2.5" />
      <path d="m3.4 7 8.6 5.8L20.6 7" />
    </>
  ),
  phone: (
    <path d="M7.4 3.2H5.6A2.6 2.6 0 0 0 3 6c.6 8.2 6.8 14.4 15 15a2.6 2.6 0 0 0 2.8-2.6v-1.8a1.6 1.6 0 0 0-1.3-1.6l-3-.6a1.6 1.6 0 0 0-1.6.6l-1 1.3a13.6 13.6 0 0 1-6.2-6.2l1.3-1a1.6 1.6 0 0 0 .6-1.6l-.6-3a1.6 1.6 0 0 0-1.6-1.3z" />
  ),
  plane: (
    <path d="M10.4 2.9a1.6 1.6 0 0 1 3.2 0v6.2l8 4.6v2.5l-8-2.4v3.9l2.6 2v2.1L12 20.6l-4.2 1.2v-2.1l2.6-2v-3.9l-8 2.4v-2.5l8-4.6z" />
  ),
  ship: (
    <>
      <path d="M4 14.4 5.4 9.6h13.2L20 14.4" />
      <path d="M12 3.6v6M7.4 9.6V7h9.2v2.6" />
      <path d="M2.6 17.2c1.6 0 1.6 1.6 3.2 1.6s1.6-1.6 3.2-1.6 1.6 1.6 3.1 1.6 1.6-1.6 3.2-1.6 1.6 1.6 3.2 1.6" />
    </>
  ),
  message: (
    <path d="M21 15.2a2 2 0 0 1-2 2H8.4L4 21.2V5.6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
  ),
  building: (
    <>
      <path d="M4.6 21.5V4.6a2 2 0 0 1 2-2h10.8a2 2 0 0 1 2 2v16.9" />
      <path d="M2.4 21.5h19.2M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
      <path d="M10 21.5v-3.2h4v3.2" />
    </>
  ),
};

function isExtra(name: GlyphName): name is ExtraGlyphName {
  return name in EXTRA;
}

export function Glyph({ name, className }: { name: GlyphName; className?: string }) {
  if (!isExtra(name)) return <Icon name={name} className={className} />;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-6", className)}
      aria-hidden="true"
    >
      {EXTRA[name]}
    </svg>
  );
}
