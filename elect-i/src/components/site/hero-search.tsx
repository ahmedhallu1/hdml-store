"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Locale } from "@/i18n/config";
import { Icon } from "@/components/ui/icon";

/**
 * The search bar IS the hero CTA for a marketplace — friction here costs more
 * than anywhere else on the page, so it is a single field with a visible
 * submit and a row of one-tap suggestions.
 */
export function HeroSearch({
  lang,
  placeholder,
  cta,
  popularLabel,
  suggestions,
}: {
  lang: Locale;
  placeholder: string;
  cta: string;
  popularLabel: string;
  suggestions: string[];
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  const go = (term: string) => {
    const q = term.trim();
    startTransition(() =>
      router.push(`/${lang}/catalog${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    );
  };

  return (
    <div className="w-full max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(value);
        }}
        className="group relative flex items-center gap-2 rounded-2xl border border-white/12 bg-obsidian-800/80 p-2 backdrop-blur-xl transition-colors duration-200 focus-within:border-accent-400/60 hover:border-white/20"
      >
        {/* Accent bloom that tracks focus. */}
        <div className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-focus-within:opacity-100 [box-shadow:0_0_0_1px_rgba(23,200,210,.35),0_12px_44px_-10px_rgba(6,166,180,.5)]" />
        <Icon name="search" className="ml-3 size-5 shrink-0 text-ink-500" />
        <label htmlFor="hero-search" className="sr-only">
          {placeholder}
        </label>
        <input
          id="hero-search"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-ink-50 placeholder:text-ink-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-accent-500 to-accent-400 px-5 font-bold text-obsidian-950 transition-all duration-200 hover:from-accent-400 hover:to-accent-300 active:scale-[0.98] disabled:opacity-60"
        >
          {cta}
          <Icon name="arrow-right" className="size-4" />
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-600">
          {popularLabel}
        </span>
        {suggestions.map((term) => (
          <button
            key={term}
            type="button"
            onClick={() => go(term)}
            className="cursor-pointer rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-ink-400 transition-all duration-200 hover:border-accent-400/40 hover:bg-accent-500/10 hover:text-accent-200"
          >
            {term}
          </button>
        ))}
      </div>
    </div>
  );
}
