import { ProductCardSkeleton } from "@/components/catalog/product-card";

/**
 * Mirrors the real layout box-for-box — same sidebar width, same grid, same
 * card aspect ratio — so the swap to real results does not move anything.
 */
export default function CatalogLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14" aria-busy="true">
      <div className="shimmer h-9 w-48 rounded-lg" />
      <div className="shimmer mt-4 h-4 w-full max-w-xl rounded" />

      <div className="mt-8 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
        <div className="panel hidden h-[26rem] lg:block" aria-hidden="true">
          <div className="flex flex-col gap-5 p-5">
            <div className="shimmer h-4 w-24 rounded" />
            <div className="shimmer h-12 w-full rounded-xl" />
            <div className="shimmer h-12 w-full rounded-xl" />
            <div className="shimmer h-12 w-full rounded-xl" />
            <div className="shimmer h-12 w-full rounded-xl" />
          </div>
        </div>
        <div className="panel h-14 lg:hidden" aria-hidden="true" />

        <div>
          <div className="flex items-center justify-between border-b border-white/8 pb-4">
            <div className="shimmer h-4 w-36 rounded" />
            <div className="shimmer h-11 w-44 rounded-xl" />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
