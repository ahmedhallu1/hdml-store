import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-700 text-white hover:bg-brand-600 active:bg-brand-800 disabled:bg-brand-200",
  secondary:
    "bg-brand-50 text-brand-800 hover:bg-brand-100 active:bg-brand-200 disabled:text-brand-300",
  outline:
    "border border-brand-200 text-brand-800 hover:border-brand-400 hover:bg-brand-50 disabled:text-gray-400",
  ghost: "text-brand-700 hover:bg-brand-50 disabled:text-gray-400",
  danger: "bg-red-600 text-white hover:bg-red-500 active:bg-red-700 disabled:bg-red-200",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm rounded-md gap-1.5",
  md: "h-10 px-4 text-sm rounded-lg gap-2",
  lg: "h-12 px-6 text-base rounded-lg gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors cursor-pointer disabled:cursor-not-allowed select-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
