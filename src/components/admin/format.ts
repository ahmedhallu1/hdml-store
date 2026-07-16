/** Pure display helpers shared by admin views (server + client safe). */

import { formatEgp, toPiasters } from "@/lib/money";

/** Render a DB numeric(12,2) (arrives as JS number) as "EGP 12,248.24". */
export function egp(dbNumeric: number | string): string {
  return formatEgp(toPiasters(String(dbNumeric)));
}

/** "16 Jul 2026, 14:03" in Cairo time. */
export function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** "16 Jul 2026" in Cairo time. */
export function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/** Bytes → human size ("1.4 MB"). */
export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
