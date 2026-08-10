"use server";

import { revalidatePath } from "next/cache";
import { supabaseService } from "@/lib/supabase/server";
import { auditLog, requireTier } from "@/lib/auth";
import { idSchema, seatSchema, translateIssues, type FieldErrors } from "@/lib/validation";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

export interface TeamState {
  errors?: FieldErrors;
  ok?: boolean;
}

export async function addSeatAction(
  lang: Locale,
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const { account, privileges } = await requireTier(lang, "merchant");
  const dict = await getDictionary(lang);
  const validation = dict.validation as unknown as Record<string, string>;

  const parsed = seatSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { errors: translateIssues(parsed.error, validation, dict.errors.validation) };
  }

  const service = supabaseService();

  // Enforce the seat cap (null = unlimited) server-side.
  if (privileges.seats !== null) {
    const { count } = await service
      .from("account_seats")
      .select("id", { count: "exact", head: true })
      .eq("account_id", account.user_id);
    if ((count ?? 0) >= privileges.seats - 1) {
      return { errors: { _form: dict.errors.forbidden } };
    }
  }

  // The teammate must already have an ELECT-I account (we look them up by the
  // account row, never provision one from here).
  const { data: target } = await service
    .from("accounts")
    .select("user_id")
    .eq("email", parsed.data.email)
    .maybeSingle();
  if (!target) return { errors: { email: dict.errors.validation } };
  if ((target.user_id as string) === account.user_id) {
    return { errors: { email: dict.errors.validation } };
  }

  const { error } = await service.from("account_seats").insert({
    account_id: account.user_id,
    user_id: target.user_id,
    role: parsed.data.role,
  });
  // A duplicate seat trips the unique constraint; treat it as success.
  if (error && !error.message.includes("duplicate")) {
    return { errors: { _form: dict.errors.generic } };
  }

  await auditLog("merchant", account.user_id, "seat.added", "account", target.user_id as string);
  revalidatePath(`/${lang}/dashboard/team`);
  return { ok: true };
}

export async function removeSeatAction(lang: Locale, formData: FormData): Promise<void> {
  const { account } = await requireTier(lang, "merchant");
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) return;

  const service = supabaseService();
  await service
    .from("account_seats")
    .delete()
    .eq("id", parsed.data)
    .eq("account_id", account.user_id);

  await auditLog("merchant", account.user_id, "seat.removed", "seat", parsed.data);
  revalidatePath(`/${lang}/dashboard/team`);
}
