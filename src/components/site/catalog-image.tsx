"use client";

import { useEffect, useState } from "react";
import { ProductPlaceholder } from "@/components/site/product-placeholder";
import { cn } from "@/lib/cn";

/**
 * Product/category <img> that falls back to the branded placeholder when the
 * source 404s (e.g. a category image that hasn't been uploaded yet). Plain
 * <img> keeps the free tier free of image-optimizer invocations.
 */
export function CatalogImage({
  src,
  alt,
  className,
  icon,
}: {
  src: string;
  alt: string;
  className?: string;
  icon?: string | null;
}) {
  const [hasError, setHasError] = useState(false);

  // Retry on client navigation to a different image.
  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (hasError) {
    return <ProductPlaceholder icon={icon} label={alt} className={className} />;
  }

  const hasObjectFit = className?.includes("object-");

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setHasError(true)}
      className={cn(!hasObjectFit && "object-cover", className)}
    />
  );
}
