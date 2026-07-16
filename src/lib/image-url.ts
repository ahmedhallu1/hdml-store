/**
 * Resolve a product image reference to a browser-loadable URL.
 * `products.images` holds either full URLs or paths inside the public
 * `product-images` Supabase Storage bucket.
 */
export function publicImageUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;
}
