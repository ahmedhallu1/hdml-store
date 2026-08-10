"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import { LanguageSwitcher } from "./language-switcher";
import { Icon } from "@/components/ui/icon";

/**
 * Full-height mobile navigation sheet.
 *
 * Composed for the small screen rather than shrunk from the desktop bar: the
 * search field leads (it is the primary action on a marketplace), links are
 * large staggered rows with an index rail, and account actions sit in a
 * separate block at the foot where a thumb reaches.
 *
 * Accessibility: focus is trapped inside the dialog while it is open, Escape
 * closes, background scroll is locked, and focus returns to the trigger on
 * close.
 */
export function MobileMenu({
  lang,
  links,
  dict,
  signedIn,
  isMerchant,
}: {
  lang: Locale;
  links: Array<{ href: string; label: string }>;
  dict: {
    menu: string;
    close: string;
    signIn: string;
    account: string;
    dashboard: string;
    startSourcing: string;
    language: string;
    search: string;
  };
  signedIn: boolean;
  isMerchant: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      // Focus trap: wrap at both ends of the sheet's tabbable set.
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const trigger = triggerRef.current;
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      // Restore focus to the button that opened the sheet.
      trigger?.focus();
    };
  }, [open]);

  const go = (event: React.FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    router.push(`/${lang}/catalog${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={dict.menu}
        aria-expanded={open}
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-white/5 hover:text-ink-50 lg:hidden"
      >
        <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
          <path
            d="M3 5.5h14M3 10h14M3 14.5h14"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={dict.close}
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-obsidian-950/85 backdrop-blur-md"
            style={{ animation: "reveal-up .2s ease-out both" }}
          />
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={dict.menu}
            className="grain absolute right-0 top-0 flex h-full w-[min(24rem,92vw)] flex-col border-l border-white/10 bg-obsidian-900 outline-none"
            style={{ animation: "sheet-in .42s cubic-bezier(0.16,1,0.3,1) both" }}
          >
            <div
              className="grid-mesh pointer-events-none absolute inset-0 opacity-40"
              aria-hidden="true"
            />

            <div className="relative flex items-center justify-between border-b border-white/8 px-5 py-4">
              <span className="type-eyebrow text-ink-600">{dict.menu}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={dict.close}
                className="inline-flex size-11 cursor-pointer items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-white/5 hover:text-ink-100"
              >
                <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
                  <path
                    d="M5 5l10 10M15 5 5 15"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="relative flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              <form onSubmit={go} role="search" className="relative">
                <label htmlFor="mobile-search" className="sr-only">
                  {dict.search}
                </label>
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-500"
                />
                <input
                  id="mobile-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={dict.search}
                  autoComplete="off"
                  className="min-h-12 w-full rounded-xl border border-white/12 bg-white/[0.04] pl-11 pr-4 text-[15px] text-ink-50 placeholder:text-ink-600 focus:border-accent-400/60 focus:outline-none"
                />
              </form>

              <nav aria-label="Primary" className="mt-6 flex flex-col">
                {links.map((link, i) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="group flex items-baseline gap-3 border-b border-white/5 py-4 text-lg font-semibold text-ink-200 transition-colors hover:text-accent-200"
                    style={{
                      animation: `reveal-up .5s cubic-bezier(0.16,1,0.3,1) ${60 + i * 45}ms both`,
                    }}
                  >
                    <span className="font-mono text-[10px] tracking-widest text-ink-700 transition-colors group-hover:text-accent-500">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {link.label}
                    <Icon
                      name="arrow-right"
                      className="ml-auto size-4 self-center text-ink-700 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-accent-300"
                    />
                  </Link>
                ))}
              </nav>
            </div>

            <div className="relative border-t border-white/8 px-5 py-5">
              <div className="flex flex-col gap-2">
                {signedIn ? (
                  <>
                    {isMerchant ? (
                      <Link
                        href={`/${lang}/dashboard`}
                        onClick={() => setOpen(false)}
                        className="min-h-12 rounded-xl border border-white/12 px-4 py-3.5 text-center text-[15px] font-semibold text-ink-200 transition-colors hover:bg-white/5"
                      >
                        {dict.dashboard}
                      </Link>
                    ) : null}
                    <Link
                      href={`/${lang}/account`}
                      onClick={() => setOpen(false)}
                      className="min-h-12 rounded-xl border border-white/12 px-4 py-3.5 text-center text-[15px] font-semibold text-ink-200 transition-colors hover:bg-white/5"
                    >
                      {dict.account}
                    </Link>
                  </>
                ) : (
                  <Link
                    href={`/${lang}/login`}
                    onClick={() => setOpen(false)}
                    className="min-h-12 rounded-xl border border-white/12 px-4 py-3.5 text-center text-[15px] font-semibold text-ink-200 transition-colors hover:bg-white/5"
                  >
                    {dict.signIn}
                  </Link>
                )}

                <Link
                  href={`/${lang}/catalog`}
                  onClick={() => setOpen(false)}
                  className="min-h-12 rounded-xl bg-gradient-to-r from-accent-500 to-accent-400 px-4 py-3.5 text-center text-[15px] font-bold text-obsidian-950"
                >
                  {dict.startSourcing}
                </Link>
              </div>

              <div className="mt-4">
                <LanguageSwitcher lang={lang} label={dict.language} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
