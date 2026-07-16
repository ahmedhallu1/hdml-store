import { cn } from "@/lib/cn";

type Tone = "brand" | "gray" | "green" | "amber" | "red" | "blue";

const tones: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-800 ring-brand-200",
  gray: "bg-gray-100 text-gray-700 ring-gray-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
};

export function Badge({
  tone = "gray",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

import type { OrderStatus, StockStatus } from "@/lib/db-types";
import { ORDER_STATUS_LABELS, STOCK_STATUS_LABELS } from "@/lib/db-types";

const ORDER_STATUS_TONES: Record<OrderStatus, Tone> = {
  awaiting_payment: "amber",
  awaiting_verification: "blue",
  paid: "green",
  fulfilled: "brand",
  cancelled: "red",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_STATUS_TONES[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

const STOCK_TONES: Record<StockStatus, Tone> = {
  in_stock: "green",
  out_of_stock: "red",
  confirm_availability: "amber",
};

export function StockBadge({ status }: { status: StockStatus }) {
  return <Badge tone={STOCK_TONES[status]}>{STOCK_STATUS_LABELS[status]}</Badge>;
}
