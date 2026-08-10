import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal } from "@/components/ui/reveal";
import { Icon, type IconName } from "@/components/ui/icon";
import { LogoMark } from "@/components/site/logo";

/**
 * Two-column auth shell: the form on the left, a reason-to-bother panel on the
 * right that collapses away on mobile so the form is never pushed below the
 * fold on a phone.
 */
export function AuthShell({
  title,
  lead,
  children,
  footer,
  aside,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
  footer?: ReactNode;
  aside?: { title: string; items: string[]; note?: string };
}) {
  return (
    <div className="grain relative overflow-hidden">
      <div className="grid-mesh radial-fade absolute inset-0" aria-hidden="true" />
      <div
        className="pointer-events-none absolute left-1/3 top-0 h-80 w-96 -translate-x-1/2 rounded-full bg-accent-500/10 blur-[120px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-16 lg:px-8 lg:py-20">
        <Reveal>
          <div className="panel spotlight p-7 sm:p-8">
            <LogoMark className="size-10" />
            <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-ink-50">{title}</h1>
            {lead ? <p className="mt-2 text-sm leading-relaxed text-ink-400">{lead}</p> : null}
            <div className="mt-7">{children}</div>
            {footer ? (
              <div className="mt-6 border-t border-white/8 pt-5 text-sm text-ink-400">{footer}</div>
            ) : null}
          </div>
        </Reveal>

        {aside ? (
          <Reveal delay={120} className="hidden lg:block">
            <div className="flex h-full flex-col justify-center">
              <h2 className="type-eyebrow flex items-center gap-3 text-accent-400/90">
                <span aria-hidden="true" className="h-px w-8 bg-gradient-to-r from-accent-400/60 to-transparent" />
                {aside.title}
              </h2>
              <ul className="mt-6 space-y-4">
                {aside.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-accent-400/25 bg-accent-500/10 text-accent-300">
                      <Icon name="check" className="size-3.5" />
                    </span>
                    <span className="text-[15px] leading-relaxed text-ink-300">{item}</span>
                  </li>
                ))}
              </ul>
              {aside.note ? (
                <p className="mt-8 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm leading-relaxed text-ink-500">
                  {aside.note}
                </p>
              ) : null}
            </div>
          </Reveal>
        ) : null}
      </div>
    </div>
  );
}

/** Small "X? Link" line used under the auth forms. */
export function AuthSwitch({
  prompt,
  href,
  label,
}: {
  prompt: string;
  href: string;
  label: string;
}) {
  return (
    <p>
      {prompt}{" "}
      <Link href={href} className="font-semibold text-accent-300 transition-colors hover:text-accent-200">
        {label}
      </Link>
    </p>
  );
}

export function AuthOutcome({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="relative mx-auto max-w-md px-4 py-20 text-center sm:px-6 lg:py-28">
      <span className="inline-flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-ink-400">
        <Icon name={icon} className="size-7" />
      </span>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink-50">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-400">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
