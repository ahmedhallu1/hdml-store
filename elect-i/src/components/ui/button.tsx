import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-accent-500 to-accent-400 text-obsidian-950 font-bold hover:from-accent-400 hover:to-accent-300 glow-accent",
  secondary:
    "bg-white/5 text-ink-100 font-semibold border border-white/12 hover:bg-white/10 hover:border-accent-400/40 backdrop-blur-sm",
  ghost: "text-ink-300 font-medium hover:text-ink-50 hover:bg-white/5",
  danger: "bg-danger-600 text-white font-semibold hover:bg-danger-500",
};

const SIZES: Record<Size, string> = {
  // Every size clears the 44px touch target on coarse pointers.
  sm: "text-sm px-3.5 py-2 min-h-9 rounded-lg gap-1.5",
  md: "text-sm px-5 py-2.5 min-h-11 rounded-xl gap-2",
  lg: "text-base px-7 py-3.5 min-h-12 rounded-xl gap-2.5",
};

const BASE =
  "inline-flex items-center justify-center cursor-pointer select-none transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <Link className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props}>
      {children}
    </Link>
  );
}
