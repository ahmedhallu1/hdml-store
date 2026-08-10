"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { saveClaimDraft, submitClaim, verifyClaimReference } from "@/lib/claim";
import type { Locale } from "@/i18n/config";

/**
 * Claim actions are reachable by anyone holding the token — the recipient has
 * no account by design. Every action therefore re-validates its input and
 * re-checks the token server-side; nothing trusts the form.
 */

export interface ActionState {
  ok: boolean;
  error?: string;
  /** Set when the reference check is locked out. */
  retryInMinutes?: number;
  /** Set on a successful final submit. */
  orderNumber?: string;
}

const referenceSchema = z.string().trim().min(4).max(64);

export async function verifyReferenceAction(
  token: string,
  lang: Locale,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = referenceSchema.safeParse(formData.get("reference"));
  if (!parsed.success) return { ok: false, error: "mismatch" };

  const result = await verifyClaimReference(token, parsed.data);
  if (result.ok) {
    revalidatePath(`/${lang}/claim/${token}`);
    return { ok: true };
  }
  return { ok: false, error: result.reason, retryInMinutes: result.retryInMinutes };
}

const recipientSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(200),
  phone: z.string().trim().min(5).max(40),
  country: z.string().trim().min(2).max(80),
  city: z.string().trim().min(1).max(120),
  address1: z.string().trim().min(4).max(240),
  address2: z.string().trim().max(240),
  postalCode: z.string().trim().max(32),
  taxId: z.string().trim().max(64),
  notes: z.string().trim().max(1000),
});

function readForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    country: String(formData.get("country") ?? ""),
    city: String(formData.get("city") ?? ""),
    address1: String(formData.get("address1") ?? ""),
    address2: String(formData.get("address2") ?? ""),
    postalCode: String(formData.get("postalCode") ?? ""),
    taxId: String(formData.get("taxId") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

/** Autosave. Never blocks the recipient — a failure here is silent by design. */
export async function saveDraftAction(token: string, formData: FormData): Promise<void> {
  try {
    await saveClaimDraft(token, readForm(formData));
  } catch (error) {
    console.error("claim draft save failed:", error);
  }
}

export async function submitClaimAction(
  token: string,
  lang: Locale,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = recipientSchema.safeParse(readForm(formData));
  if (!parsed.success) return { ok: false, error: "validation" };

  const result = await submitClaim(token, parsed.data, lang);
  if (!result.ok) return { ok: false, error: result.reason };

  revalidatePath(`/${lang}/claim/${token}`);
  return { ok: true, orderNumber: result.orderNumber };
}
