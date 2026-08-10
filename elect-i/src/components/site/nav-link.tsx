"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * Primary nav item with an underline that grows from the centre on hover and
 * stays lit for the active section.
 *
 * "Active" is a prefix match on the path after the locale segment, so
 * /en/product/foo keeps Catalog lit — a buyer three levels into the catalogue
 * should still be able to see where they are.
 */
export function NavLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  const pathname = usePathname();
  const section = href.split("/").slice(2).join("/");
  const current = pathname.split("/").slice(2).join("/");
  const active = section !== "" && (current === section || current.startsWith(`${section}/`));

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200",
        active ? "text-ink-50" : "text-ink-400 hover:text-ink-50",
        className,
      )}
    >
      {label}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-3 bottom-1 h-px origin-center bg-gradient-to-r from-transparent via-accent-400 to-transparent transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
        )}
      />
    </Link>
  );
}
