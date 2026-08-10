"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/config";

/**
 * Swaps the leading locale segment and remembers the choice for a year, so a
 * returning visitor is not re-negotiated by Accept-Language on every visit
 * (middleware reads the same cookie).
 */
export function LanguageSwitcher({ lang, label }: { lang: Locale; label: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    if (next === lang) return;
    document.cookie = `eig_locale=${next}; path=/; max-age=31536000; samesite=lax`;
    const segments = pathname.split("/");
    segments[1] = next;
    startTransition(() => router.push(segments.join("/") || "/"));
  }

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <svg viewBox="0 0 16 16" className="pointer-events-none absolute left-2.5 size-4 text-ink-400" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.3" />
        <path d="M2 8h12M8 1.9c1.7 1.8 2.5 4 2.5 6.1S9.7 12.4 8 14.1C6.3 12.4 5.5 10.2 5.5 8S6.3 3.7 8 1.9Z" stroke="currentColor" strokeWidth="1.3" />
      </svg>
      <select
        value={lang}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
        className="cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-7 text-sm font-medium text-ink-300 transition-colors hover:border-white/20 hover:text-ink-100 focus:border-accent-400 focus:outline-none disabled:opacity-50"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} className="bg-obsidian-800 text-ink-100">
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 16 16" className="pointer-events-none absolute right-2 size-3.5 text-ink-500" fill="none" aria-hidden="true">
        <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}
