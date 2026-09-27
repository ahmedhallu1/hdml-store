import { CartProvider } from "@/lib/cart";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { MaintenanceBanner } from "@/components/site/maintenance-banner";

/** Storefront shell: cart context + sticky header + footer around every page. */
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <MaintenanceBanner />
      <Header />
      <main className="flex-1 min-w-0">{children}</main>
      <Footer />
    </CartProvider>
  );
}
