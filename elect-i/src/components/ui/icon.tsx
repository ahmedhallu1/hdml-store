import { cn } from "@/lib/cn";

/**
 * Inline SVG icon set (stroke-based, 24px grid, inherits currentColor).
 * Emoji are never used as icons.
 */
export type IconName =
  | "cpu"
  | "factory"
  | "home"
  | "shirt"
  | "briefcase"
  | "car"
  | "package"
  | "flask"
  | "search"
  | "shield"
  | "bolt"
  | "globe"
  | "link"
  | "wallet"
  | "code"
  | "truck"
  | "check"
  | "arrow-right"
  | "spark"
  | "credit-card"
  | "receipt";

const PATHS: Record<IconName, React.ReactNode> = {
  cpu: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M9 1.5v2M15 1.5v2M9 20.5v2M15 20.5v2M1.5 9h2M1.5 15h2M20.5 9h2M20.5 15h2" />
    </>
  ),
  factory: (
    <>
      <path d="M2.5 20.5h19M4 20.5V9l5 3.5V9l5 3.5V6l6 4v10.5" />
      <path d="M8 16.5h1.5M13 16.5h1.5M18 16.5h1.5" />
    </>
  ),
  home: (
    <>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.6v10.9h13V9.6" />
      <path d="M9.5 20.5v-6h5v6" />
    </>
  ),
  shirt: (
    <>
      <path d="M8.5 3.5 4 5.8l1.4 4.2 2.1-.6v11.1h9V9.4l2.1.6L20 5.8l-4.5-2.3" />
      <path d="M8.5 3.5a3.5 3.5 0 0 0 7 0" />
    </>
  ),
  briefcase: (
    <>
      <rect x="2.5" y="7" width="19" height="13.5" rx="2.5" />
      <path d="M8.5 7V5.2a1.7 1.7 0 0 1 1.7-1.7h3.6a1.7 1.7 0 0 1 1.7 1.7V7M2.5 12.5h19" />
    </>
  ),
  car: (
    <>
      <path d="M3 13.5 5 8a2.5 2.5 0 0 1 2.4-1.7h9.2A2.5 2.5 0 0 1 19 8l2 5.5" />
      <path d="M2.5 13.5h19v4.5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1h-12v1a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1z" />
      <path d="M6 16h1.5M16.5 16H18" />
    </>
  ),
  package: (
    <>
      <path d="M12 2.8 3.5 7.2v9.6L12 21.2l8.5-4.4V7.2z" />
      <path d="M3.5 7.2 12 11.6l8.5-4.4M12 11.6v9.6" />
    </>
  ),
  flask: (
    <>
      <path d="M9.5 2.8v6.4L4.4 18a2.2 2.2 0 0 0 1.9 3.3h11.4a2.2 2.2 0 0 0 1.9-3.3l-5.1-8.8V2.8" />
      <path d="M8 2.8h8M7.4 14.5h9.2" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.8" />
      <path d="m15.5 15.5 5 5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.5 20 6v6c0 4.8-3.4 8.6-8 9.5-4.6-.9-8-4.7-8-9.5V6z" />
      <path d="m8.6 12 2.4 2.4 4.4-4.8" />
    </>
  ),
  bolt: <path d="M13.5 2.5 4.5 13.5h6l-.5 8 9-11h-6z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9.3" />
      <path d="M2.8 12h18.4M12 2.7c2.6 2.7 3.8 6 3.8 9.3S14.6 18.6 12 21.3C9.4 18.6 8.2 15.3 8.2 12S9.4 5.4 12 2.7Z" />
    </>
  ),
  link: (
    <>
      <path d="M10 13.8a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5" />
      <path d="M14 10.2a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" />
    </>
  ),
  wallet: (
    <>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5" />
      <rect x="3" y="7.5" width="18" height="12" rx="2.5" />
      <circle cx="16.5" cy="13.5" r="1.3" />
    </>
  ),
  code: <path d="m8.5 8.5-4 4 4 4M15.5 8.5l4 4-4 4M13.5 4.5l-3 15" />,
  truck: (
    <>
      <path d="M2.5 6.5h11v10h-11zM13.5 10h3.8l3.2 3.2v3.3h-7z" />
      <circle cx="6.5" cy="18.5" r="1.9" />
      <circle cx="17" cy="18.5" r="1.9" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5 10-11" />,
  "credit-card": (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19M6 15.5h4" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 2.5h14v19l-2.3-1.6-2.3 1.6-2.4-1.6-2.3 1.6-2.4-1.6L5 21.5z" />
      <path d="M8.5 7.5h7M8.5 11.5h7M8.5 15.5h4" />
    </>
  ),
  "arrow-right": <path d="M4 12h16m-6-6 6 6-6 6" />,
  spark: <path d="M12 2.5 14 9.5l7 2-7 2-2 7-2-7-7-2 7-2z" />,
};

export function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
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
      {PATHS[name]}
    </svg>
  );
}
