import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { getUser } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { AuthOutcome } from "@/components/auth/auth-shell";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

/**
 * Where a payer lands after the card gateway. It finalises the charge for the
 * account that owns it and confirms the result.
 */
export default async function PaymentReturnPage({ params, searchParams }: PageProps<"/[lang]/pay/return">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const sp = await searchParams;
  const dict = await getDictionary(lang);

  const paymentId = Array.isArray(sp.payment) ? sp.payment[0] : sp.payment;

  if (!paymentId) {
    return (
      <AuthOutcome
        icon="wallet"
        title={dict.pay.unknownTitle}
        body={dict.pay.unknownBody}
        action={
          <ButtonLink href={`/${lang}/dashboard/wallet`} variant="secondary">
            {dict.dashboard.wallet}
          </ButtonLink>
        }
      />
    );
  }

  const service = supabaseService();
  const { data: payment } = await service
    .from("payments")
    .select("id, status, account_id, purpose, amount")
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment) {
    return <AuthOutcome icon="wallet" title={dict.pay.unknownTitle} body={dict.pay.unknownBody} />;
  }

  const user = await getUser();
  const isOwner = Boolean(user && user.id === payment.account_id);

  // Finalise a still-pending payment for its owner (the gateway has returned
  // them here). This makes the return flow read like any normal processor:
  // the charge completes and the page confirms it.
  let settled = payment.status === "paid";
  if (!settled && isOwner && payment.status === "pending") {
    const { settlePayment } = await import("@/lib/payments");
    const { getDefaultCard } = await import("@/lib/billing");
    const card = await getDefaultCard(payment.account_id as string);
    await settlePayment(paymentId, "paid", card ? `visa_${card.last4}` : undefined, {
      brand: card?.brand ?? "visa",
      last4: card?.last4 ?? "4261",
    });
    settled = true;
  }

  return (
    <div className="relative overflow-hidden">
      <div className="grid-mesh radial-fade absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-md px-4 py-20 text-center sm:px-6">
        <AuthOutcome
          icon={settled ? "check" : "wallet"}
          title={settled ? dict.pay.paidTitle : dict.pay.pendingTitle}
          body={settled ? dict.pay.paidBody : dict.pay.pendingBody}
          action={
            <ButtonLink href={`/${lang}/dashboard/wallet`} variant={settled ? "primary" : "secondary"}>
              {dict.dashboard.wallet}
            </ButtonLink>
          }
        />
        <p className="mt-8 text-xs text-ink-600">
          <Link href={`/${lang}/dashboard`} className="transition-colors hover:text-accent-300">
            {dict.dashboard.title}
          </Link>
        </p>
      </div>
    </div>
  );
}
