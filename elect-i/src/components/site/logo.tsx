import { cn } from "@/lib/cn";

/**
 * Inline so the wordmark can inherit `currentColor` and the gradients can
 * animate. The static files in /public/brand are for favicons, OG images and
 * email, where inline SVG is not available.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn("size-9", className)} aria-hidden="true">
      <defs>
        <linearGradient id="lm-a" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#45DFE4" />
          <stop offset=".55" stopColor="#06A6B4" />
          <stop offset="1" stopColor="#004754" />
        </linearGradient>
        <linearGradient id="lm-b" x1="14" y1="14" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C0F5F6" />
          <stop offset="1" stopColor="#17C8D2" />
        </linearGradient>
        <clipPath id="lm-hex">
          <path d="M24 2.6 41.4 12.7v20.6L24 43.4 6.6 33.3V12.7Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#lm-hex)">
        <ellipse
          cx="24"
          cy="24"
          rx="21"
          ry="7.5"
          transform="rotate(-27 24 24)"
          stroke="url(#lm-a)"
          strokeWidth="1.2"
          opacity=".45"
        />
      </g>
      <path
        d="M24 2.6 41.4 12.7v20.6L24 43.4 6.6 33.3V12.7Z"
        stroke="url(#lm-a)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 17.2h11M15.5 24h7.5M15.5 30.8h11"
        stroke="url(#lm-b)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path d="M31.6 15.4v17.2" stroke="url(#lm-b)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="31.6" cy="13" r="1.9" fill="#F59E0B" />
      <circle cx="31.6" cy="35" r="1.5" fill="#17C8D2" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-[17px] font-extrabold tracking-tight text-ink-50">ELECT-I</span>
        <span className="mt-0.5 text-[9px] font-semibold tracking-[0.34em] text-accent-400">
          GLOBAL
        </span>
      </span>
    </span>
  );
}
