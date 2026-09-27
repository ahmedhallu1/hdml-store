import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

/** Checkout is disabled while the store is out of service. */
export default function CheckoutPage() {
  notFound();
}
