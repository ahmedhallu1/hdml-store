/** Weekly-slot date maths (pure; Cairo-time aware via Intl). */

import type { WeeklySlot } from "./types";

/** The wall-clock offset (minutes) of a timezone at a given instant. */
function tzOffsetMinutes(date: Date, timeZone: string): number {
  // Format the instant in the target zone, reinterpret as UTC, diff.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** The day-of-week (0=Sun) of an instant, in the given timezone. */
function zonedDayOfWeek(date: Date, timeZone: string): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

/**
 * Build the UTC Date for a given calendar day (in tz) at slot.hour:slot.minute.
 * `base` supplies the year/month/day (interpreted in tz).
 */
function slotInstantForDay(base: Date, slot: WeeklySlot, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const y = get("year");
  const m = get("month");
  const d = get("day");
  // Guess the UTC instant, then correct for the zone offset at that instant.
  const guess = new Date(Date.UTC(y, m - 1, d, slot.hour, slot.minute, 0));
  const offset = tzOffsetMinutes(guess, timeZone);
  return new Date(guess.getTime() - offset * 60000);
}

/**
 * The next occurrence of the weekly slot strictly AFTER `after`.
 * e.g. slot = Sunday 19:00 → the next Sunday 19:00 (Cairo) after `after`.
 */
export function nextSlotAfter(after: Date, slot: WeeklySlot, timeZone: string): Date {
  for (let addDays = 0; addDays <= 7; addDays++) {
    const day = new Date(after.getTime() + addDays * 86400000);
    if (zonedDayOfWeek(day, timeZone) !== slot.dayOfWeek) continue;
    const instant = slotInstantForDay(day, slot, timeZone);
    if (instant.getTime() > after.getTime()) return instant;
  }
  // Fallback: 7 days out (shouldn't happen).
  return slotInstantForDay(new Date(after.getTime() + 7 * 86400000), slot, timeZone);
}

/** Human label for a slot instant, e.g. "Sun, 20 Jul 2026, 19:00". */
export function formatSlot(iso: string, timeZone = "Africa/Cairo"): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
