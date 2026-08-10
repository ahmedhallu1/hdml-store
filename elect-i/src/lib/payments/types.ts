import type { PaymentStatus } from "@/lib/db-types";

/** What a payment is for. Drives which record gets settled on success. */
export type PaymentPurpose = "order" | "wallet_topup" | "subscription";

export interface CreateIntentInput {
  /** Our own eig.payments row id — passed to the provider as the merchant ref. */
  paymentId: string;
  /** Integer USD cents, always resolved server-side. */
  amountCents: number;
  purpose: PaymentPurpose;
  /** Where the provider should send the payer back to. */
  returnUrl: string;
  customer: {
    email: string;
    name: string;
    phone?: string | null;
  };
  description: string;
}

export interface ProviderIntent {
  /** The provider's own identifier for this attempt. */
  providerRef: string;
  /**
   * Where to send the payer to complete the payment. `null` means the
   * provider settles inline with no redirect (the mock provider does this).
   */
  redirectUrl: string | null;
  status: PaymentStatus;
  raw: Record<string, unknown>;
}

export interface WebhookResult {
  /** Our eig.payments row id, recovered from the provider's payload. */
  paymentId: string;
  providerRef: string;
  status: PaymentStatus;
  /** Integer cents as reported by the provider, for cross-checking. */
  amountCents: number;
  raw: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: string;
  /** True when the provider is configured well enough to be used. */
  isConfigured(): boolean;
  createIntent(input: CreateIntentInput): Promise<ProviderIntent>;
  /**
   * Verify and parse an inbound provider callback. MUST return null when the
   * signature does not verify — the caller treats null as "reject".
   */
  parseWebhook(request: Request, rawBody: string): Promise<WebhookResult | null>;
}
