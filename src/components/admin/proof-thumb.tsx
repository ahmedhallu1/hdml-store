"use client";

/**
 * Proof thumbnail that degrades instead of showing a broken-image icon.
 *
 * Plenty of historical orders have a proof row whose file no longer exists in
 * the private bucket (or never did). The signed-URL endpoint then 404s, so we
 * catch onError and render a "file unavailable" tile that still links to the
 * proof page for the full explanation.
 */

import Link from "next/link";
import { useState } from "react";

export function ProofThumb({
  src,
  href,
  alt,
  className = "size-40",
}: {
  src: string;
  href: string;
  alt: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <Link
        href={href}
        className={`flex ${className} shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-2 text-center`}
        title="The stored file is missing or corrupted"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-6 text-amber-600"
          aria-hidden
        >
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
        <span className="text-[11px] font-medium leading-tight text-amber-800">
          File missing or corrupted
        </span>
      </Link>
    );
  }

  return (
    <Link href={href} className="block shrink-0" title="Open full size">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onError={() => setBroken(true)}
        className={`${className} rounded-lg border border-gray-200 object-cover`}
      />
    </Link>
  );
}
