"use server";

/** Customer profile update (account page). */

import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { parseOrErrors, profileSchema } from "@/lib/validation";
import type { AuthFormState } from "@/server/actions/auth";

export async function updateProfile(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await requireUser("/account");

  const governorateRaw = formData.get("governorate");
  const parsed = parseOrErrors(profileSchema, {
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    companyName: formData.get("companyName") ?? "",
    taxId: formData.get("taxId") ?? "",
    governorate: governorateRaw ? governorateRaw : undefined,
    address: formData.get("address") ?? "",
  });
  if (!parsed.ok) {
    return { error: "Please fix the highlighted fields.", fieldErrors: parsed.errors };
  }
  const input = parsed.data;

  // RLS-scoped client: the owner-only policies enforce user_id = auth.uid().
  const supabase = await supabaseServer();
  const { error } = await supabase.from("customer_profiles").upsert({
    user_id: user.id,
    full_name: input.fullName,
    phone: input.phone,
    company_name: input.companyName || null,
    tax_id: input.taxId || null,
    governorate: input.governorate ?? null,
    address: input.address || null,
  });
  if (error) {
    console.error("updateProfile failed:", error.message);
    return { error: "Your profile could not be saved. Please try again." };
  }
  return { success: "Profile saved." };
}
