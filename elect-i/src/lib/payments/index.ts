import "server-only";
import { supabaseService } from "@/lib/supabase/server";
import { centsToDecimalString, toCents } from "@/lib/money";
import { TIER_PRICING, type Tier } from "@/lib/tiers";
import { auditLog } from "@/lib/auth";
import type { PaymentProvider, PaymentPurpose } from "./types";
import { MockProvider } from "./mock";
import { PaymobProvider } from "./paymob";

export type { PaymentProvider, PaymentPurpose } from "./types";

/** Wallet top-up bounds, in integer USD cents. */
export const MIN_TOPUP_CENTS = 1_000; // $10
export const MAX_TOPUP_CENTS = 5_000_000; // $50,000

/**
 * Resolve the active provider. Defaults to the mock provider so the platform
 * is fully exercisable before a merchant account exists; switching to a live
 * gateway is a single env var plus its secrets.
 */
export function activeProvider(): PaymentProvider {
  const configured = (process.env.PAYMENT_PROVIDER ?? "mock").toLowerCase();
  if (configured === "paymob") {
    const paymob = new PaymobProvider();
    if (!paymob.isConfigured()) {
      // Failing loudly beats silently taking simulated money in production.
      throw new Error(
        "PAYMENT_PROVIDER=paymob but PAYMOB_* secrets are missing. Set them or switch back to mock.",
      );
    }
    return paymob;
  }
  return new MockProvider();
}

export interface IntentResult {
  paymentId: string;
  provider: string;
  /** Null when the provider settles inline with no redirect. */
  redirectUrl: string | null;
  amountCents: number;
}

interface StartPaymentInput {
  accountId: string | null;
  orderId?: string | null;
  amountCents: number;
  purpose: PaymentPurpose;
  description: string;
  returnPath: string;
  customer: { email: string; name: string; phone?: string | null };
  idempotencyKey?: string;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
}

/**
 * Create the eig.payments row, then hand it to the provider. The row is
 * written FIRST so a provider call that succeeds but whose response is lost
 * still has a record to reconcile against.
 */
async function startPayment(input: StartPaymentInput): Promise<IntentResult> {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("Payment amount must be a positive integer number of cents");
  }

  const provider = activeProvider();
  const service = supabaseService();

  // Replaying an idempotency key returns the original attempt untouched.
  if (input.idempotencyKey) {
    const { data: existing } = await service
      .from("payments")
      .select("id, provider, amount, raw")
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) {
      return {
        paymentId: existing.id as string,
        provider: existing.provider as string,
        redirectUrl: ((existing.raw as Record<string, unknown>)?.redirect_url as string) ?? null,
        amountCents: toCents(String(existing.amount)),
      };
    }
  }

  const { data: row, error } = await service
    .from("payments")
    .insert({
      account_id: input.accountId,
      order_id: input.orderId ?? null,
      provider: provider.name,
      purpose: input.purpose,
      amount: centsToDecimalString(input.amountCents),
      currency: "USD",
      status: "pending",
      idempotency_key: input.idempotencyKey ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create payment: ${error.message}`);

  const paymentId = row.id as string;
  const intent = await provider.createIntent({
    paymentId,
    amountCents: input.amountCents,
    purpose: input.purpose,
    returnUrl: `${siteUrl()}${input.returnPath}`,
    customer: input.customer,
    description: input.description,
  });

  await service
    .from("payments")
    .update({
      provider_ref: intent.providerRef,
      status: intent.status,
      raw: { ...intent.raw, redirect_url: intent.redirectUrl },
    })
    .eq("id", paymentId);

  return {
    paymentId,
    provider: provider.name,
    redirectUrl: intent.redirectUrl,
    amountCents: input.amountCents,
  };
}

/**
 * Start a merchant wallet top-up.
 *
 * The amount is the one field a client legitimately supplies, so it is
 * bounds-checked here; everything else is derived from the authenticated
 * account server-side. Callers must have already authorized the account.
 */
export async function createTopUpIntent(
  accountId: string,
  amountCents: number,
): Promise<IntentResult> {
  if (amountCents < MIN_TOPUP_CENTS || amountCents > MAX_TOPUP_CENTS) {
    throw new Error(
      `Top-up must be between ${MIN_TOPUP_CENTS / 100} and ${MAX_TOPUP_CENTS / 100} USD`,
    );
  }
  const service = supabaseService();
  const { data: account, error } = await service
    .from("accounts")
    .select("email, full_name, phone")
    .eq("user_id", accountId)
    .single();
  if (error || !account) throw new Error("Account not found");

  return startPayment({
    accountId,
    amountCents,
    purpose: "wallet_topup",
    description: "ELECT-I Global wallet top-up",
    returnPath: "/pay/return",
    customer: {
      email: account.email as string,
      name: (account.full_name as string) || "Merchant",
      phone: account.phone as string | null,
    },
  });
}

/** Charge for an order that is not being paid from the wallet. */
export async function createOrderPaymentIntent(orderId: string): Promise<IntentResult> {
  const service = supabaseService();
  const { data: order, error } = await service
    .from("orders")
    .select("id, order_number, total, amount_paid, buyer_account_id, recipient_email, recipient_name")
    .eq("id", orderId)
    .single();
  if (error || !order) throw new Error("Order not found");

  // Amount is recomputed from the DB — never accepted from the caller.
  const dueCents = toCents(String(order.total)) - toCents(String(order.amount_paid));
  if (dueCents <= 0) throw new Error("Order has nothing left to pay");

  return startPayment({
    accountId: order.buyer_account_id as string | null,
    orderId,
    amountCents: dueCents,
    purpose: "order",
    description: `Order ${order.order_number}`,
    returnPath: "/pay/return",
    customer: {
      email: (order.recipient_email as string) ?? "",
      name: (order.recipient_name as string) ?? "Buyer",
    },
  });
}

/** Charge a merchant tier subscription. */
export async function createSubscriptionIntent(
  accountId: string,
  tier: Exclude<Tier, "buyer">,
  period: "monthly" | "annual",
): Promise<IntentResult> {
  const pricing = TIER_PRICING[tier];
  const amountCents = period === "annual" ? pricing.annualCents : pricing.monthlyCents;

  const service = supabaseService();
  const { data: account, error } = await service
    .from("accounts")
    .select("email, full_name, phone")
    .eq("user_id", accountId)
    .single();
  if (error || !account) throw new Error("Account not found");

  return startPayment({
    accountId,
    amountCents,
    purpose: "subscription",
    description: `ELECT-I Global ${tier} membership (${period})`,
    returnPath: "/pay/return",
    customer: {
      email: account.email as string,
      name: (account.full_name as string) || "Merchant",
      phone: account.phone as string | null,
    },
  });
}

/**
 * Settle a payment exactly once and apply its side effect.
 *
 * Idempotent by design: the status guard means a replayed webhook is a no-op,
 * and the wallet credit is keyed on the payment id inside the DB function, so
 * a top-up can never be credited twice.
 */
export async function settlePayment(
  paymentId: string,
  status: "paid" | "failed",
  providerRef?: string,
  raw?: Record<string, unknown>,
): Promise<{ applied: boolean }> {
  const service = supabaseService();

  const { data: payment, error } = await service
    .from("payments")
    .select("id, account_id, order_id, purpose, amount, status")
    .eq("id", paymentId)
    .maybeSingle();
  if (error || !payment) throw new Error("Payment not found");

  if (payment.status === "paid" || payment.status === "failed") {
    return { applied: false };
  }

  await service
    .from("payments")
    .update({
      status,
      provider_ref: providerRef ?? undefined,
      raw: raw ?? undefined,
    })
    .eq("id", paymentId)
    .eq("status", "pending");

  if (status !== "paid") return { applied: false };

  const amountCents = toCents(String(payment.amount));

  if (payment.purpose === "wallet_topup" && payment.account_id) {
    const { error: rpcError } = await service.rpc("apply_wallet_txn", {
      p_account_id: payment.account_id,
      p_kind: "topup",
      p_amount: centsToDecimalString(amountCents),
      p_order_id: null,
      p_idempotency_key: `payment:${paymentId}`,
      p_note: "Card top-up",
    });
    if (rpcError) throw new Error(`Wallet credit failed: ${rpcError.message}`);
  }

  if (payment.purpose === "order" && payment.order_id) {
    const { data: order } = await service
      .from("orders")
      .select("amount_paid, on_behalf")
      .eq("id", payment.order_id)
      .single();
    const paidCents = toCents(String(order?.amount_paid ?? "0")) + amountCents;
    await service
      .from("orders")
      .update({
        amount_paid: centsToDecimalString(paidCents),
        payment_status: "paid",
        status: order?.on_behalf ? "awaiting_recipient" : "paid",
      })
      .eq("id", payment.order_id);
  }

  await auditLog("system", null, "payment.settled", "payment", paymentId, {
    purpose: payment.purpose,
    amount_cents: amountCents,
  });

  return { applied: true };
}
