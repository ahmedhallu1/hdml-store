"use server";

/**
 * Admin site-settings mutations (seller info, delivery, ordering, contact)
 * and the payment-methods manager.
 */

import { refresh } from "next/cache";
import { requireAdmin, auditLog } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { updateSetting } from "@/lib/settings";
import {
  adminContactSettingsSchema,
  adminDeliverySettingsSchema,
  adminOrderingSettingsSchema,
  adminPaymentMethodQrClearSchema,
  adminPaymentMethodSaveSchema,
  adminPaymentMethodToggleSchema,
  adminSellerInfoSchema,
  parseOrErrors,
} from "@/lib/validation";
import {
  failure,
  fdString,
  success,
  type ActionResult,
  type ActionState,
} from "@/server/actions/admin/action-result";

// ---------------------------------------------------------------------------
// site_settings forms
// ---------------------------------------------------------------------------

export async function updateSellerInfoAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseOrErrors(adminSellerInfoSchema, {
    name: fdString(formData, "name"),
    taxId: fdString(formData, "taxId"),
    address: fdString(formData, "address"),
  });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);

  const value = {
    name: parsed.data.name,
    tax_id: parsed.data.taxId ?? "",
    address: parsed.data.address ?? "",
  };
  try {
    await updateSetting("seller_info", value);
  } catch (e) {
    return failure(e instanceof Error ? e.message : "Save failed");
  }
  await auditLog(admin.id, "settings.update", "site_settings", "seller_info", value);
  refresh();
  return success("Seller info saved.");
}

export async function updateDeliverySettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseOrErrors(adminDeliverySettingsSchema, {
    message: fdString(formData, "message"),
    regions: fdString(formData, "regions"),
    time: fdString(formData, "time"),
    feeNote: fdString(formData, "feeNote"),
  });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);

  const value = {
    message: parsed.data.message,
    regions: parsed.data.regions ?? "",
    time: parsed.data.time ?? "",
    fee_note: parsed.data.feeNote ?? "",
  };
  try {
    await updateSetting("delivery", value);
  } catch (e) {
    return failure(e instanceof Error ? e.message : "Save failed");
  }
  await auditLog(admin.id, "settings.update", "site_settings", "delivery", value);
  refresh();
  return success("Delivery settings saved.");
}

export async function updateOrderingSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseOrErrors(adminOrderingSettingsSchema, {
    minOrderEgp: fdString(formData, "minOrderEgp") || "0",
    vatNote: fdString(formData, "vatNote"),
    externalOrderUrl: fdString(formData, "externalOrderUrl"),
  });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);

  const value = {
    min_order_egp: parsed.data.minOrderEgp,
    currency: "EGP",
    vat_note: parsed.data.vatNote ?? "",
    external_order_url: parsed.data.externalOrderUrl ?? "",
  };
  try {
    await updateSetting("ordering", value);
  } catch (e) {
    return failure(e instanceof Error ? e.message : "Save failed");
  }
  await auditLog(admin.id, "settings.update", "site_settings", "ordering", value);
  refresh();
  return success("Ordering settings saved.");
}

export async function updateContactSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = parseOrErrors(adminContactSettingsSchema, {
    phone: fdString(formData, "phone"),
    whatsapp: fdString(formData, "whatsapp"),
    email: fdString(formData, "email"),
    facebook: fdString(formData, "facebook"),
    instagram: fdString(formData, "instagram"),
  });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);

  const value = {
    phone: parsed.data.phone ?? "",
    whatsapp: parsed.data.whatsapp ?? "",
    email: parsed.data.email ?? "",
    facebook: parsed.data.facebook ?? "",
    instagram: parsed.data.instagram ?? "",
  };
  try {
    await updateSetting("contact", value);
  } catch (e) {
    return failure(e instanceof Error ? e.message : "Save failed");
  }
  await auditLog(admin.id, "settings.update", "site_settings", "contact", value);
  refresh();
  return success("Contact settings saved.");
}

// ---------------------------------------------------------------------------
// Payment methods
// ---------------------------------------------------------------------------

export interface SavePaymentMethodResult extends ActionResult {
  id?: string;
}

export async function savePaymentMethodAction(input: unknown): Promise<SavePaymentMethodResult> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(adminPaymentMethodSaveSchema, input);
  if (!parsed.ok) return { ok: false, message: "Please fix the highlighted fields", errors: parsed.errors };
  const d = parsed.data;

  const service = supabaseService();
  const fields = {
    kind: d.kind,
    label: d.label,
    number: d.number,
    display_name: d.displayName || null,
    instructions: d.instructions || null,
    active: d.active,
    sort: d.sort,
    min_order_egp: d.minOrderEgp,
  };

  if (d.methodId) {
    const { error } = await service.from("payment_methods").update(fields).eq("id", d.methodId);
    if (error) return { ok: false, message: `Update failed: ${error.message}` };
    await auditLog(admin.id, "payment_method.update", "payment_methods", d.methodId, fields);
    refresh();
    return { ok: true, id: d.methodId, message: "Payment method saved." };
  }

  const { data, error } = await service
    .from("payment_methods")
    .insert(fields)
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: `Create failed: ${error?.message ?? "no row"}` };
  await auditLog(admin.id, "payment_method.create", "payment_methods", data.id as string, fields);
  refresh();
  return { ok: true, id: data.id as string, message: "Payment method created." };
}

export async function togglePaymentMethodAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(adminPaymentMethodToggleSchema, input);
  if (!parsed.ok) return failure("Invalid input", parsed.errors);
  const { methodId, active } = parsed.data;

  const service = supabaseService();
  const { error } = await service.from("payment_methods").update({ active }).eq("id", methodId);
  if (error) return failure(`Update failed: ${error.message}`);
  await auditLog(admin.id, "payment_method.toggle", "payment_methods", methodId, { active });
  refresh();
  return success(active ? "Method activated." : "Method deactivated.");
}

export async function clearPaymentMethodQrAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(adminPaymentMethodQrClearSchema, input);
  if (!parsed.ok) return failure("Invalid input", parsed.errors);
  const { methodId } = parsed.data;

  const service = supabaseService();
  const { error } = await service
    .from("payment_methods")
    .update({ qr_path: null })
    .eq("id", methodId);
  if (error) return failure(`Update failed: ${error.message}`);
  await auditLog(admin.id, "payment_method.qr_clear", "payment_methods", methodId, {});
  refresh();
  return success("QR image cleared — checkout will auto-generate a QR from the number.");
}
