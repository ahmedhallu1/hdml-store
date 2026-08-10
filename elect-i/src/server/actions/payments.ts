"use server";

import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth";
import { activeProvider, settlePayment } from "@/lib/payments";
import { supabaseService } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation";
import type { Locale } from "@/i18n/config";

/**
 * Settle a mock payment.
 *
 * ONLY works when the mock provider is active — a live gateway settles through
 * its signed webhook, never through a button. The caller must own the payment.
 * This lets the full money flow be tested with zero payment infrastructure.
 */
export async function simulatePaymentAction(
  lang: Locale,
  paymentId: string,
): Promise<{ ok: boolean }> {
  if (activeProvider().name !== "mock") return { ok: false };

  const parsed = idSchema.safeParse(paymentId);
  if (!parsed.success) return { ok: false };

  const account = await requireAccount(lang);
  const service = supabaseService();
  const { data: payment } = await service
    .from("payments")
    .select("id, account_id, status")
    .eq("id", parsed.data)
    .maybeSingle();

  if (!payment || payment.account_id !== account.user_id) return { ok: false };
  if (payment.status === "paid") return { ok: true };

  await settlePayment(parsed.data, "paid", `mock_settled_${Date.now()}`, { simulated: true });
  revalidatePath(`/${lang}/pay/return`);
  revalidatePath(`/${lang}/dashboard/wallet`);
  return { ok: true };
}
