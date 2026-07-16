/**
 * Shared result shape + FormData helpers for admin server actions.
 * Plain module (NOT "use server") so it can export types and sync helpers.
 */

export interface ActionResult {
  ok: boolean;
  /** Human-readable outcome (success or failure). */
  message?: string;
  /** Field-level validation errors keyed by field name ("_form" = general). */
  errors?: Record<string, string>;
}

export type ActionState = ActionResult | null;

export function fdString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

export function fdBool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "true" || v === "on" || v === "1";
}

export function fdInt(fd: FormData, key: string, fallback = 0): number {
  const n = Number.parseInt(fdString(fd, key), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function failure(message: string, errors?: Record<string, string>): ActionResult {
  return { ok: false, message, errors };
}

export function success(message?: string): ActionResult {
  return { ok: true, message };
}
