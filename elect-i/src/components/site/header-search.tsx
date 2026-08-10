"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { Icon } from "@/components/ui/icon";

/**
 * Persistent catalogue search in the command bar.
 *
 * Collapsed it is a single icon button; focused it expands into a field. This
 * keeps the bar uncluttered on a marketing page while making search reachable
 * from every route — a wholesale buyer's most common action should never be
 * two clicks away.
 *
 * "/" focuses it from anywhere, the way a console would, but only when the
 * visitor is not already typing somewhere else.
 */
export function HeaderSearch({ lang, label }: { lang: Locale; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active as HTMLElement | null)?.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const q = value.trim();
    router.push(`/${lang}/catalog${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    setOpen(false);
    setValue("");
    inputRef.current?.blur();
  };

  return (
    <form
      onSubmit={submit}
      role="search"
      className={`group relative hidden items-center rounded-xl border transition-[width,border-color,background-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:flex ${
        open
          ? "w-64 border-accent-400/45 bg-obsidian-800/80"
          : "w-11 border-white/10 bg-white/[0.03] hover:border-white/20"
      }`}
    >
      <button
        type={open ? "submit" : "button"}
        onClick={() => {
          if (!open) {
            setOpen(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }
        }}
        aria-label={label}
        className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-ink-400 transition-colors hover:text-accent-200"
      >
        <Icon name="search" className="size-[18px]" />
      </button>
      <label htmlFor="header-search" className="sr-only">
        {label}
      </label>
      <input
        id="header-search"
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => {
          if (!value) setOpen(false);
        }}
        placeholder={label}
        autoComplete="off"
        tabIndex={open ? 0 : -1}
        className={`min-w-0 flex-1 bg-transparent pr-3 text-sm text-ink-50 placeholder:text-ink-600 focus:outline-none ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        } transition-opacity duration-300`}
      />
      {!open ? (
        <kbd
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 rounded border border-white/10 bg-obsidian-800 px-1.5 py-0.5 font-mono text-[10px] text-ink-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        >
          /
        </kbd>
      ) : null}
    </form>
  );
}
