/** Egypt-specific helpers: governorates and phone validation. */

export const GOVERNORATES = [
  "Alexandria", "Aswan", "Asyut", "Beheira", "Beni Suef", "Cairo", "Dakahlia",
  "Damietta", "Faiyum", "Gharbia", "Giza", "Ismailia", "Kafr El Sheikh",
  "Luxor", "Matrouh", "Minya", "Monufia", "New Valley", "North Sinai",
  "Port Said", "Qalyubia", "Qena", "Red Sea", "Sharqia", "Sohag",
  "South Sinai", "Suez",
] as const;

export type Governorate = (typeof GOVERNORATES)[number];

/**
 * Normalize an Egyptian mobile number to local `01XXXXXXXXX` form.
 * Accepts `01…`, `+201…`, `00201…`, `201…`, with spaces/dashes.
 * Returns null when the number is not a valid Egyptian mobile.
 */
export function normalizeEgyptMobile(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, "").replace(/^\+/, "");
  let local: string | null = null;
  if (/^01[0125]\d{8}$/.test(digits)) local = digits;
  else if (/^201[0125]\d{8}$/.test(digits)) local = `0${digits.slice(2)}`;
  else if (/^00201[0125]\d{8}$/.test(digits)) local = `0${digits.slice(4)}`;
  return local;
}

/** Local `01XXXXXXXXX` -> `+201XXXXXXXXX` (for wa.me links etc.). */
export function toInternational(localMobile: string): string {
  return `+2${localMobile}`;
}

export function waLink(localMobile: string): string {
  return `https://wa.me/2${localMobile}`;
}
