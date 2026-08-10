export default function ProductLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12" aria-busy="true">
      <div className="shimmer h-3 w-56 max-w-full rounded" />

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
        <div className="panel overflow-hidden" aria-hidden="true">
          {/* Same square the real gallery reserves — no shift on swap. */}
          <div className="shimmer aspect-square w-full" />
        </div>

        <div className="flex flex-col gap-5" aria-hidden="true">
          <div className="flex gap-2">
            <div className="shimmer h-6 w-24 rounded-full" />
            <div className="shimmer h-6 w-32 rounded-full" />
          </div>
          <div className="shimmer h-8 w-full rounded-lg" />
          <div className="shimmer h-8 w-3/4 rounded-lg" />
          <div className="shimmer h-4 w-52 rounded" />
          <div className="shimmer h-16 w-full rounded-xl" />
          <div className="panel p-5">
            <div className="shimmer h-3 w-20 rounded" />
            <div className="shimmer mt-3 h-10 w-44 rounded-lg" />
            <div className="shimmer mt-4 h-4 w-40 rounded" />
          </div>
          <div className="shimmer h-12 w-full rounded-xl" />
          <div className="flex gap-2.5">
            <div className="shimmer h-12 flex-1 rounded-xl" />
            <div className="shimmer h-12 flex-1 rounded-xl" />
          </div>
        </div>
      </div>

      <div className="mt-14" aria-hidden="true">
        <div className="shimmer h-6 w-44 rounded" />
        <div className="shimmer mt-4 h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}
