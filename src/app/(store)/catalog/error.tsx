"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function CatalogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Catalog error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold text-gray-900">We couldn&apos;t load the catalog</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
        Something went wrong while fetching products. It&apos;s usually temporary — please try
        again.
      </p>
      <Button onClick={reset} className="mt-6">
        Try again
      </Button>
    </div>
  );
}
