import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { formatEgp, toPiasters } from "@/lib/money";
import type { OrderStatus } from "@/lib/db-types";
import { OrderStatusBadge } from "@/components/ui/badge";
import { ProfileForm, type ProfileDefaults } from "@/components/account/profile-form";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { LogoutButton } from "@/components/account/logout-button";

export const metadata: Metadata = {
  title: "My account",
  robots: { index: false },
};

interface OrderRow {
  id: string;
  order_ref: string;
  created_at: string;
  status: OrderStatus;
  total: number;
  tracking_token: string;
}

function orderDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export default async function AccountPage() {
  const user = await requireUser("/account");
  const supabase = await supabaseServer();

  // Both reads are RLS-scoped to the signed-in customer.
  const [{ data: profile }, { data: orderRows, error: ordersError }] = await Promise.all([
    supabase
      .from("customer_profiles")
      .select("full_name, phone, company_name, tax_id, governorate, address")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("id, order_ref, created_at, status, total, tracking_token")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const defaults: ProfileDefaults = {
    fullName: profile?.full_name ?? (user.user_metadata?.full_name as string) ?? "",
    phone: profile?.phone ?? "",
    companyName: profile?.company_name ?? "",
    taxId: profile?.tax_id ?? "",
    governorate: profile?.governorate ?? "",
    address: profile?.address ?? "",
  };
  const orders = (orderRows ?? []) as OrderRow[];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">My account</h1>
          <p className="mt-1 text-sm text-gray-500">{user.email}</p>
        </div>
        <LogoutButton />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {/* Orders */}
          <section
            aria-labelledby="orders-heading"
            className="rise-in rounded-xl border border-gray-200 bg-white"
          >
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 id="orders-heading" className="text-base font-semibold text-gray-900">
                My orders
              </h2>
            </div>

            {ordersError && (
              <p className="px-5 py-6 text-sm text-red-600">
                Your orders could not be loaded right now. Please refresh the page.
              </p>
            )}

            {!ordersError && orders.length === 0 && (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-gray-500">You haven&rsquo;t placed any orders yet.</p>
                <Link
                  href="/catalog"
                  className="mt-3 inline-flex items-center rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
                >
                  Browse the catalog
                </Link>
              </div>
            )}

            {orders.length > 0 && (
              <ul className="divide-y divide-gray-100">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/order/${o.tracking_token}`}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4 hover:bg-gray-50"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium text-gray-900">{o.order_ref}</span>
                        <span className="block text-xs text-gray-500">
                          {orderDate(o.created_at)}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <OrderStatusBadge status={o.status} />
                        <span className="text-sm font-semibold text-gray-900">
                          {formatEgp(toPiasters(String(o.total)))}
                        </span>
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="size-4 text-gray-400"
                          aria-hidden
                        >
                          <path
                            fillRule="evenodd"
                            d="M7.2 4.2a.75.75 0 0 1 1.06 0l5.25 5.27a.75.75 0 0 1 0 1.06L8.26 15.8a.75.75 0 1 1-1.06-1.06L11.92 10 7.2 5.26a.75.75 0 0 1 0-1.06Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {/* Profile */}
          <section
            aria-labelledby="profile-heading"
            className="rise-in rounded-xl border border-gray-200 bg-white p-5"
          >
            <h2 id="profile-heading" className="text-base font-semibold text-gray-900">
              Profile
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Used to prefill checkout — you can still adjust details per order.
            </p>
            <div className="mt-4">
              <ProfileForm defaults={defaults} />
            </div>
          </section>

          {/* Password */}
          <section
            aria-labelledby="password-heading"
            className="rise-in rounded-xl border border-gray-200 bg-white p-5"
          >
            <h2 id="password-heading" className="text-base font-semibold text-gray-900">
              Password
            </h2>
            <div className="mt-4">
              <ChangePasswordForm />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
