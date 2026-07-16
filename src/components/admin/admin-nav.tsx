"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/proofs", label: "Proof review" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/products/review", label: "Needs review" },
  { href: "/admin/taxonomy", label: "Categories & Brands" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/audit", label: "Audit log" },
] as const;

/** Sidebar / top-bar nav. The LONGEST matching href wins the active state so
 *  "/admin/products/review" highlights "Needs review", not "Products". */
export function AdminNav() {
  const pathname = usePathname();

  const active = ITEMS.reduce<string | null>((best, item) => {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (!matches) return best;
    if (!best || item.href.length > best.length) return item.href;
    return best;
  }, null);

  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:p-3">
      {ITEMS.map((item) => {
        const isActive = active === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-brand-700 text-white"
                : "text-gray-600 hover:bg-brand-50 hover:text-brand-800",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
