import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { OrderStatus, StockStatus, VerificationLevel } from "@/lib/db-types";
import type { Tier } from "@/lib/tiers";

type Tone = "neutral" | "accent" | "verify" | "settled" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-white/6 text-ink-300 border-white/10",
  accent: "bg-accent-500/12 text-accent-200 border-accent-400/30",
  verify: "bg-verify-500/12 text-verify-300 border-verify-500/30",
  settled: "bg-settled-500/12 text-settled-400 border-settled-500/30",
  danger: "bg-danger-500/12 text-danger-400 border-danger-500/30",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Amber is reserved for verification; never reuse it for money or status. */
const VERIFICATION_TONE: Record<VerificationLevel, Tone> = {
  unverified: "neutral",
  verified: "verify",
  audited: "verify",
  premium_manufacturer: "verify",
  authorized_distributor: "verify",
};

export function VerificationBadge({
  level,
  label,
}: {
  level: VerificationLevel;
  label: string;
}) {
  return (
    <Badge tone={VERIFICATION_TONE[level]}>
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
        <path
          d="M8 1.5 13.5 4v4c0 3.2-2.3 5.7-5.5 6.5C4.8 13.7 2.5 11.2 2.5 8V4L8 1.5Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="m5.8 8 1.6 1.6 3-3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </Badge>
  );
}

const ORDER_TONE: Record<OrderStatus, Tone> = {
  draft: "neutral",
  awaiting_payment: "verify",
  paid: "settled",
  awaiting_recipient: "accent",
  claimed: "accent",
  ready_to_ship: "accent",
  shipped: "accent",
  delivered: "settled",
  cancelled: "danger",
  refunded: "danger",
};

export function OrderStatusBadge({ status, label }: { status: OrderStatus; label: string }) {
  return <Badge tone={ORDER_TONE[status]}>{label}</Badge>;
}

const STOCK_TONE: Record<StockStatus, Tone> = {
  in_stock: "settled",
  made_to_order: "accent",
  out_of_stock: "danger",
  confirm_availability: "verify",
};

export function StockBadge({ status, label }: { status: StockStatus; label: string }) {
  return <Badge tone={STOCK_TONE[status]}>{label}</Badge>;
}

const TIER_TONE: Record<Tier, Tone> = {
  buyer: "neutral",
  merchant: "accent",
  elite: "verify",
};

export function TierBadge({ tier, label }: { tier: Tier; label: string }) {
  return <Badge tone={TIER_TONE[tier]}>{label}</Badge>;
}
