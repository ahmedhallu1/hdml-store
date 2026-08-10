import { ProductCardSkeleton } from "@/components/catalog/product-card";

export default function CategoryLoading() {
  return (
    <div aria-busy="true">
      <section className="relative overflow-hidden border-b border-white/8">
        <div className="grid-mesh radial-fade absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="shimmer h-3 w-40 rounded" />
          <div className="shimmer mt-6 size-14 rounded-2xl" />
          <div className="shimmer mt-5 h-10 w-72 max-w-full rounded-lg" />
          <div className="shimmer mt-4 h-4 w-full max-w-xl rounded" />
          <div className="shimmer mt-2 h-4 w-2/3 max-w-md rounded" />
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
          <div className="panel hidden h-[26rem] lg:block" aria-hidden="true">
            <div className="flex flex-col gap-5 p-5">
              <div className="shimmer h-4 w-24 rounded" />
              <div className="shimmer h-12 w-full rounded-xl" />
              <div className="shimmer h-12 w-full rounded-xl" />
              <div className="shimmer h-12 w-full rounded-xl" />
            </div>
          </div>
          <div className="panel h-14 lg:hidden" aria-hidden="true" />

          <div>
            <div className="flex items-center justify-between border-b border-white/8 pb-4">
              <div className="shimmer h-4 w-32 rounded" />
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
    </div>
  );
}
