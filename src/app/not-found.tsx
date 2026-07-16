import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">Page not found</h1>
      <p className="mt-3 max-w-md text-gray-600">
        The page you are looking for doesn&apos;t exist, or the product may no longer be
        available.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-lg bg-brand-700 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-600"
        >
          Back to home
        </Link>
        <Link
          href="/catalog"
          className="inline-flex h-10 items-center rounded-lg border border-brand-200 px-4 text-sm font-medium text-brand-800 transition-colors hover:border-brand-400 hover:bg-brand-50"
        >
          Browse the catalog
        </Link>
      </div>
    </div>
  );
}
