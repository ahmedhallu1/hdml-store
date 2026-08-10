"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/**
 * Sidebar on desktop, horizontally scrolling tab strip on mobile — a stacked
 * vertical nav would push the actual content off a phone screen.
 */
export function DashboardNav({
  lang,
  showApi,
  labels,
}: {
  lang: Locale;
  showApi: boolean;
  labels: Record<
    "overview" | "onBehalf" | "orders" | "wallet" | "billing" | "api" | "team" | "settings",
    string
  >;
}) {
  const pathname = usePathname();
  const base = `/${lang}/dashboard`;

  const items: Array<{ href: string; label: string; icon: IconName; show: boolean }> = [
    { href: base, label: labels.overview, icon: "spark", show: true },
    { href: `${base}/on-behalf`, label: labels.onBehalf, icon: "link", show: true },
    { href: `${base}/orders`, label: labels.orders, icon: "package", show: true },
    { href: `${base}/wallet`, label: labels.wallet, icon: "wallet", show: true },
    { href: `${base}/billing`, label: labels.billing, icon: "credit-card", show: true },
    { href: `${base}/api`, label: labels.api, icon: "code", show: showApi },
    { href: `${base}/team`, label: labels.team, icon: "shield", show: true },
    { href: `${base}/settings`, label: labels.settings, icon: "cpu", show: true },
  ];

  return (
    <nav aria-label={labels.overview} className="lg:sticky lg:top-20 lg:self-start">
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {items
          .filter((item) => item.show)
          .map((item) => {
            // Exact match for the index so it does not light up on children.
            const active = item.href === base ? pathname === base : pathname.startsWith(item.href);
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 text-sm font-medium transition-colors duration-200 lg:w-full",
                    active
                      ? "border border-accent-400/30 bg-accent-500/10 text-accent-200"
                      : "border border-transparent text-ink-400 hover:bg-white/5 hover:text-ink-100",
                  )}
                >
                  <Icon name={item.icon} className="size-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}
