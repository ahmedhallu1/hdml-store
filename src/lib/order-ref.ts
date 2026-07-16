/**
 * Order references follow the format seen on HDML's sample receipts:
 * `I` + YYYYMMDDHHMMSS in Cairo local time, e.g. I20260713175900.
 * The DB enforces uniqueness; on collision the caller retries with an
 * increasing `bump` (seconds offset) until a free reference is found.
 */

export function orderRef(date: Date = new Date(), bumpSeconds = 0): string {
  const d = bumpSeconds ? new Date(date.getTime() + bumpSeconds * 1000) : date;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // Intl can render midnight as "24" with some ICU versions; normalize.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `I${get("year")}${get("month")}${get("day")}${hour}${get("minute")}${get("second")}`;
}

export const ORDER_REF_PATTERN = /^I\d{14}$/;

/** Format a Date as dd/mm/yyyy in Cairo time (receipt "Date:" line). */
export function receiptDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
