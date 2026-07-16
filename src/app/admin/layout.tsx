import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { logout } from "@/server/actions/auth";

export const metadata: Metadata = {
  title: { default: "HDML Admin", template: "%s | HDML Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-50 lg:flex-row">
      {/* Sidebar (top bar on mobile) */}
      <aside className="shrink-0 border-b border-gray-200 bg-white lg:w-56 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-4 py-3 lg:py-4">
          <Link
            href="/admin"
            className="text-base font-bold tracking-widest text-brand-700"
          >
            HDML <span className="font-medium text-gray-400">Admin</span>
          </Link>
        </div>
        <AdminNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2.5 lg:px-6">
          <p className="truncate text-sm font-medium text-gray-500">Store administration</p>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              View store
            </Link>
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                Log out
              </Button>
            </form>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
