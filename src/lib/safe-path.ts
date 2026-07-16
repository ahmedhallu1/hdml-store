/**
 * Validate a post-auth "?next=" destination. Only same-origin relative paths
 * are allowed. Backslashes are rejected explicitly: browsers (and the WHATWG
 * URL parser) treat "\\" as "/" under http(s), so "/\\evil.com" would resolve
 * to https://evil.com/ — a classic open-redirect bypass of naive "/" checks.
 */
export function safeNextPath(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2000) return fallback;
  if (raw.includes("\\")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(raw)) return fallback;
  if (!/^\/(?!\/)/.test(raw)) return fallback;
  return raw;
}
