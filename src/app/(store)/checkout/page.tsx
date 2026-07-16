import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/settings";
import { toPiasters } from "@/lib/money";
import {
  CheckoutForm,
  type CheckoutPaymentMethod,
  type CheckoutPrefill,
} from "@/components/checkout/checkout-form";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const supabase = await supabaseServer();

  // Profile prefill + active payment methods, both via RLS.
  const [{ data: profile }, { data: methods }, settings] = await Promise.all([
    supabase
      .from("customer_profiles")
      .select("full_name, phone, company_name, tax_id, governorate, address")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("payment_methods")
      .select("id, kind, label, number, display_name")
      .order("sort")
      .order("label"),
    getSiteSettings(),
  ]);

  const prefill: CheckoutPrefill = {
    fullName: profile?.full_name ?? (user.user_metadata?.full_name as string) ?? "",
    email: user.email ?? "",
    phone: profile?.phone ?? "",
    companyName: profile?.company_name ?? "",
    taxId: profile?.tax_id ?? "",
    governorate: profile?.governorate ?? "",
    address: profile?.address ?? "",
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-gray-900">Checkout</h1>
      <p className="mt-1 text-sm text-gray-500">
        Manual payment by Instapay or mobile wallet — transfer details come right after you place
        the order.
      </p>
      <div className="mt-6">
        <CheckoutForm
          prefill={prefill}
          paymentMethods={(methods ?? []) as CheckoutPaymentMethod[]}
          minOrderPiasters={toPiasters(String(settings.ordering.min_order_egp))}
          vatNote={settings.ordering.vat_note}
        />
      </div>
    </div>
  );
}
