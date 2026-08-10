import "server-only";
import type { Locale } from "./config";
import en from "./dictionaries/en.json";

/**
 * English is imported statically so it can serve as the structural type and
 * the runtime fallback; other locales load on demand.
 */
export type Dictionary = typeof en;

const dictionaries = {
  en: async () => en,
  zh: async () => (await import("./dictionaries/zh.json")).default,
} satisfies Record<Locale, () => Promise<unknown>>;

/**
 * Deep-merge a partial translation over English so a missing key renders the
 * English string rather than crashing or showing a raw key.
 */
function withFallback<T>(base: T, override: unknown): T {
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    return (override ?? base) as T;
  }
  const result = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    result[key] = key in result ? withFallback(result[key], value) : value;
  }
  return result as T;
}

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const loaded = await dictionaries[locale]();
  return locale === "en" ? (loaded as Dictionary) : withFallback(en, loaded);
}
