"use client";

import Link from "next/link";
import { useState } from "react";
import { SearchForm } from "@/components/site/search-form";

const linkClass =
  "rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-800";

/** Hamburger toggle + collapsible panel shown under the header on phones. */
export function MobileMenu({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center rounded-lg p-2 text-brand-800 hover:bg-brand-50"
      >
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        {open ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="size-6"
            aria-hidden
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="size-6"
            aria-hidden
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        )}
      </button>

      {open && (
        <div
          id="mobile-menu"
          className="absolute inset-x-0 top-full border-b border-gray-200 bg-white px-4 pb-4 pt-2 shadow-sm"
        >
          <SearchForm id="mobile-search" className="mb-2" />
          <nav aria-label="Mobile" className="flex flex-col">
            <Link href="/catalog" onClick={close} className={linkClass}>
              Catalog
            </Link>
            <Link href="/contact" onClick={close} className={linkClass}>
              Contact
            </Link>
            <Link href={signedIn ? "/account" : "/login"} onClick={close} className={linkClass}>
              {signedIn ? "Account" : "Sign in"}
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}
