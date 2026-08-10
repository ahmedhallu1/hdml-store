import "server-only";
import type {
  CreateIntentInput,
  PaymentProvider,
  ProviderIntent,
  WebhookResult,
} from "./types";

/**
 * Zero-configuration provider used until a real merchant account exists.
 *
 * It does NOT move money. It routes the payer to an internal confirmation
 * screen where the payment can be marked settled, so the whole prepaid-claim
 * flow is exercisable end to end today. Every record it creates is stamped
 * with provider "mock" so live and simulated payments can never be confused,
 * and it refuses to run when PAYMENT_PROVIDER is not explicitly "mock".
 */
export class MockProvider implements PaymentProvider {
  readonly name = "mock";

  isConfigured(): boolean {
    return true;
  }

  async createIntent(input: CreateIntentInput): Promise<ProviderIntent> {
    return {
      providerRef: `mock_${input.paymentId}`,
      // Internal simulation screen, not a third-party checkout.
      redirectUrl: `${input.returnUrl}?simulate=1&payment=${encodeURIComponent(input.paymentId)}`,
      status: "pending",
      raw: {
        simulated: true,
        amount_cents: input.amountCents,
        purpose: input.purpose,
        description: input.description,
      },
    };
  }

  /**
   * The mock provider has no external callbacks; settlement happens through
   * the internal simulation action instead. Returning null keeps the webhook
   * route closed.
   */
  async parseWebhook(): Promise<WebhookResult | null> {
    return null;
  }
}
