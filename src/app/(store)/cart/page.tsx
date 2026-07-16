import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/settings";
import { toPiasters } from "@/lib/money";
import { CartView } from "@/components/cart/cart-view";

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false },
};

export default async function CartPage() {
  const settings = await getSiteSettings();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-gray-900">Your cart</h1>
      <div className="mt-6">
        <CartView
          minOrderPiasters={toPiasters(String(settings.ordering.min_order_egp))}
          vatNote={settings.ordering.vat_note}
        />
      </div>
    </div>
  );
}
