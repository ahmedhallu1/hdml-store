/* eslint-disable @next/next/no-img-element -- Supplier photos are remote and
   unsized; next/image's optimizer is not available on the Workers runtime this
   app deploys to. The wrapper below reserves the box, so there is no CLS. */
import { cn } from "@/lib/cn";
import { ProductVisual } from "./product-visual";

/**
 * Product imagery with a first-class branded fallback.
 *
 * Most mirrored rows arrive with no photo, so the fallback is not an
 * afterthought: it is a per-category brand emblem (see ProductVisual), clearly
 * an "image pending" placeholder rather than a misleading product picture.
 *
 * The frame always reserves a square, whether or not a photo loads, so a grid
 * of mixed photo/placeholder cards never shifts layout.
 */
export function ProductImage({
  src,
  alt,
  sku,
  groupKey,
  categoryLabel,
  className,
  priority = false,
  sizes = "(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 92vw",
}: {
  src: string | null;
  alt: string;
  sku: string;
  /** Drives which category emblem renders when there is no photo. */
  groupKey?: string | null;
  /** The product's real category name, shown as the placeholder caption. */
  categoryLabel?: string | null;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-square w-full overflow-hidden rounded-[calc(var(--radius-card)-1px)] bg-obsidian-800",
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          sizes={sizes}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          className="size-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
        />
      ) : (
        <ProductVisual
          groupKey={groupKey}
          sku={sku}
          label={categoryLabel}
          className="transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
        />
      )}
    </div>
  );
}
