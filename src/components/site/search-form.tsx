import { cn } from "@/lib/cn";

/**
 * Plain GET form to /catalog?q= — works with zero JavaScript. Shared by the
 * desktop header and the mobile menu.
 */
export function SearchForm({
  className,
  defaultValue,
  id = "site-search",
}: {
  className?: string;
  defaultValue?: string;
  id?: string;
}) {
  return (
    <form action="/catalog" method="get" role="search" className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        Search products
      </label>
      <input
        id={id}
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search products…"
        autoComplete="off"
        className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-3 pr-10 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      <button
        type="submit"
        aria-label="Search"
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-gray-400 hover:text-brand-700"
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
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
    </form>
  );
}
