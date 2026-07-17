"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Controlled quantity stepper: a "−" button, a typeable numeric field, and a
 * "+" button. Wholesale buyers can type large quantities directly; the field
 * clamps to at least `min` on blur. The parent owns the numeric value.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
  size = "md",
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  const [text, setText] = useState(String(value));

  // Reflect external value changes (± buttons, parent reset) while leaving a
  // partially-typed field untouched.
  useEffect(() => {
    setText((prev) => (Number.parseInt(prev, 10) === value ? prev : String(value)));
  }, [value]);

  const clamp = (n: number) => {
    let next = n;
    if (max !== undefined) next = Math.min(next, max);
    return Math.max(next, min);
  };

  const commit = (n: number) => {
    const c = clamp(n);
    setText(String(c));
    onChange(c);
  };

  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;

  const heights = size === "sm" ? "h-9" : "h-11";
  const btn = size === "sm" ? "w-9 text-base" : "w-11 text-lg";
  const field = size === "sm" ? "w-10 text-sm" : "w-14 text-[15px]";

  const btnClass = cn(
    "flex items-center justify-center font-medium leading-none text-gray-700 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-300 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent",
    btn,
  );

  return (
    <div
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded-lg border border-gray-300 bg-white",
        disabled && "opacity-60",
        heights,
      )}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={disabled || atMin}
        onClick={() => commit(value - 1)}
        className={btnClass}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={ariaLabel ?? "Quantity"}
        disabled={disabled}
        value={text}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, "");
          setText(digits);
          if (digits !== "") {
            const n = Number.parseInt(digits, 10);
            // Allow values below `min` while typing (clamped on blur); never
            // let the field exceed `max`.
            if (Number.isSafeInteger(n)) onChange(max !== undefined ? Math.min(n, max) : n);
          }
        }}
        onBlur={() => {
          const n = Number.parseInt(text, 10);
          commit(Number.isSafeInteger(n) ? n : min);
        }}
        className={cn(
          "border-x border-gray-300 bg-transparent text-center font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-300 disabled:text-gray-500",
          field,
        )}
      />
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={disabled || atMax}
        onClick={() => commit(value + 1)}
        className={btnClass}
      >
        +
      </button>
    </div>
  );
}
