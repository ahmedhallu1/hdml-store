/** Slug + deterministic SKU generation (pure, portable: Node + Workers). */

export function slugify(input: string, maxLength = 80): string {
  const s = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const trimmed = s.slice(0, maxLength).replace(/-+$/g, "");
  return trimmed || "product";
}

/** FNV-1a 64-bit hash, returned as fixed-width base36. Stable across runs. */
export function fnv1a64(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  const bytes = new TextEncoder().encode(input);
  for (const b of bytes) {
    hash ^= BigInt(b);
    hash = (hash * prime) & mask;
  }
  return hash.toString(36).padStart(13, "0");
}

/**
 * Deterministic SKU: same (normalized name, price) always yields the same SKU,
 * making the catalog import idempotent. Format: HDML-XXXXXXXX (base36).
 */
export function productSku(name: string, priceDecimal: string): string {
  const key = `${name.trim().toLowerCase().replace(/\s+/g, " ")}|${priceDecimal}`;
  return `HDML-${fnv1a64(key).slice(0, 8).toUpperCase()}`;
}
