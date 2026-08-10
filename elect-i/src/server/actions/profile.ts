"use server";

import { revalidatePath } from "next/cache";
import { supabaseService } from "@/lib/supabase/server";
import { auditLog, requireAccount } from "@/lib/auth";
import { profileSchema, translateIssues, type FieldErrors } from "@/lib/validation";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

export interface ProfileState {
  errors?: FieldErrors;
  saved?: boolean;
}

export async function updateProfileAction(
  lang: Locale,
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  // Re-resolves the session server-side; the form never says who it is.
  const account = await requireAccount(lang);
  const dict = await getDictionary(lang);

  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    companyName: formData.get("companyName"),
    companyCountry: formData.get("companyCountry"),
    phone: formData.get("phone"),
    vatNumber: formData.get("vatNumber"),
  });

  if (!parsed.success) {
    return {
      errors: translateIssues(
        parsed.error,
        dict.validation as unknown as Record<string, string>,
        dict.errors.validation,
      ),
    };
  }

  const service = supabaseService();
  const { error } = await service
    .from("accounts")
    .update({
      full_name: parsed.data.fullName,
      company_name: parsed.data.companyName,
      company_country: parsed.data.companyCountry,
      phone: parsed.data.phone,
      vat_number: parsed.data.vatNumber,
    })
    .eq("user_id", account.user_id);

  if (error) return { errors: { _form: dict.errors.generic } };

  await auditLog("buyer", account.user_id, "profile.updated", "account", account.user_id);
  revalidatePath(`/${lang}/account`);
  return { saved: true };
}
