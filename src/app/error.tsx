"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Something went wrong</h1>
      <p className="mt-3 max-w-md text-gray-600">
        An unexpected error occurred. It&apos;s usually temporary — trying again often fixes it.
      </p>
      {error.digest && <p className="mt-2 text-xs text-gray-400">Error reference: {error.digest}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <a
          href="/"
          className="inline-flex h-10 items-center rounded-lg border border-brand-200 px-4 text-sm font-medium text-brand-800 transition-colors hover:border-brand-400 hover:bg-brand-50"
        >
          Back to home
        </a>
      </div>
    </div>
  );
}
