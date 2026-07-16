"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";

/** Header cart icon with live item count. */
export function CartButton() {
  const { count, ready } = useCart();
  return (
    <Link
      href="/cart"
      aria-label={`Shopping cart, ${count} item${count === 1 ? "" : "s"}`}
      className="relative inline-flex items-center justify-center rounded-lg p-2 text-brand-800 hover:bg-brand-50"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
        aria-hidden
      >
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="17" cy="20" r="1.4" />
        <path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.47 1.18h7.9a1.5 1.5 0 0 0 1.46-1.15L20.5 8H6" />
      </svg>
      {ready && count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-700 px-1 text-[11px] font-semibold text-white">
          {count > 999 ? "999+" : count}
        </span>
      )}
    </Link>
  );
}
