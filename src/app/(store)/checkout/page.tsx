import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { getSiteSettings, telegramUrl } from "@/lib/settings";
import { toPiasters } from "@/lib/money";
import { OrderingPaused } from "@/components/site/ordering-paused";
import {
  CheckoutForm,
  type CheckoutAccount,
  type CheckoutPaymentMethod,
} from "@/components/checkout/checkout-form";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const supabase = await supabaseServer();

  // Name (for the "ordering as" line) + active payment methods, both via RLS.
  const [{ data: profile }, { data: methods }, settings] = await Promise.all([
    supabase.from("customer_profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("payment_methods")
      .select("id, kind, label, number, display_name, instructions, min_order_egp")
      .eq("active", true)
      .order("sort")
      .order("label"),
    getSiteSettings(),
  ]);

  const account: CheckoutAccount = {
    name:
      profile?.full_name ??
      (user.user_metadata?.full_name as string | undefined) ??
      user.email?.split("@")[0] ??
      "",
    email: user.email ?? "",
  };

  // Closed for orders: show the notice + waiting list instead of the form. The
  // server action refuses too, so this is presentation, not the actual guard.
  if (!settings.ordering.accepting_orders) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Checkout</h1>
        <OrderingPaused
          note={settings.ordering.paused_note}
          defaultEmail={account.email}
          className="mt-6"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-gray-900">Checkout</h1>
      <p className="mt-1 text-sm text-gray-500">
        Manual payment by Instapay, mobile wallet or bank transfer — transfer details come right
        after you place the order.
      </p>
      <div className="mt-6">
        <CheckoutForm
          account={account}
          paymentMethods={(methods ?? []) as CheckoutPaymentMethod[]}
          minOrderPiasters={toPiasters(String(settings.ordering.min_order_egp))}
          vatNote={settings.ordering.vat_note}
          telegramUrl={telegramUrl(settings.contact.telegram)}
        />
      </div>
    </div>
  );
}
