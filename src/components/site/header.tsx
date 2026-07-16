import Image from "next/image";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { CartButton } from "@/components/cart/cart-button";
import { MobileMenu } from "@/components/site/mobile-menu";
import { SearchForm } from "@/components/site/search-form";

/**
 * Sticky storefront header. Server component: auth state is resolved here so
 * the "Sign in / Account" area never flickers on load.
 */
export async function Header() {
  const user = await getUser();
  const signedIn = Boolean(user);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <div className="relative mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <MobileMenu signedIn={signedIn} />

        <Link href="/" aria-label="HDML — home" className="flex shrink-0 items-center">
          <Image
            src="/brand/logo-tight.png"
            alt="HDML"
            width={120}
            height={28}
            priority
            className="h-7 w-auto"
          />
        </Link>

        <nav aria-label="Main" className="hidden items-center md:flex">
          <Link
            href="/catalog"
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-800"
          >
            Catalog
          </Link>
        </nav>

        <div className="hidden max-w-lg flex-1 md:block">
          <SearchForm />
        </div>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Link
            href={signedIn ? "/account" : "/login"}
            className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-800 md:inline-flex"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
              aria-hidden
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c1.6-3.2 4.6-5 8-5s6.4 1.8 8 5" />
            </svg>
            {signedIn ? "Account" : "Sign in"}
          </Link>
          <CartButton />
        </div>
      </div>
    </header>
  );
}
