import "server-only";
import { timingSafeEqual } from "@/lib/crypto";
import type {
  CreateIntentInput,
  PaymentProvider,
  ProviderIntent,
  WebhookResult,
} from "./types";

/**
 * Paymob adapter (Egypt-based, settles to an Egyptian entity — which is what
 * the operator has). Activated by setting PAYMENT_PROVIDER=paymob plus the
 * three secrets below; until then the mock provider is used and none of this
 * code runs.
 *
 * Flow: auth token -> order registration -> payment key -> hosted iframe.
 * Amounts are integer cents throughout; Paymob calls this field `amount_cents`
 * too, so no unit conversion happens here.
 */

const API = "https://accept.paymob.com/api";

interface PaymobConfig {
  apiKey: string;
  hmacSecret: string;
  integrationId: string;
  iframeId: string;
}

function readConfig(): PaymobConfig | null {
  const apiKey = process.env.PAYMOB_API_KEY;
  const hmacSecret = process.env.PAYMOB_HMAC_SECRET;
  const integrationId = process.env.PAYMOB_INTEGRATION_ID;
  const iframeId = process.env.PAYMOB_IFRAME_ID;
  if (!apiKey || !hmacSecret || !integrationId || !iframeId) return null;
  return { apiKey, hmacSecret, integrationId, iframeId };
}

/** Fields Paymob concatenates, in this exact order, to build the HMAC. */
const HMAC_FIELDS = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occured",
  "has_parent_transaction",
  "id",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
  "order.id",
  "owner",
  "pending",
  "source_data.pan",
  "source_data.sub_type",
  "source_data.type",
  "success",
] as const;

function pick(obj: Record<string, unknown>, path: string): string {
  const value = path
    .split(".")
    .reduce<unknown>((acc, key) => (acc as Record<string, unknown> | null)?.[key], obj);
  if (value === null || value === undefined) return "";
  return String(value);
}

async function hmacSha512Hex(message: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class PaymobProvider implements PaymentProvider {
  readonly name = "paymob";

  isConfigured(): boolean {
    return readConfig() !== null;
  }

  async createIntent(input: CreateIntentInput): Promise<ProviderIntent> {
    const config = readConfig();
    if (!config) throw new Error("Paymob is not configured");

    const authRes = await fetch(`${API}/auth/tokens`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_key: config.apiKey }),
    });
    if (!authRes.ok) throw new Error(`Paymob auth failed: ${authRes.status}`);
    const { token } = (await authRes.json()) as { token: string };

    const orderRes = await fetch(`${API}/ecommerce/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        auth_token: token,
        delivery_needed: false,
        amount_cents: input.amountCents,
        currency: "USD",
        // Our payments row id, echoed back on the callback.
        merchant_order_id: input.paymentId,
        items: [],
      }),
    });
    if (!orderRes.ok) throw new Error(`Paymob order failed: ${orderRes.status}`);
    const order = (await orderRes.json()) as { id: number };

    const [firstName, ...rest] = input.customer.name.trim().split(/\s+/);
    const keyRes = await fetch(`${API}/acceptance/payment_keys`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        auth_token: token,
        amount_cents: input.amountCents,
        expiration: 3600,
        order_id: order.id,
        currency: "USD",
        integration_id: Number(config.integrationId),
        billing_data: {
          email: input.customer.email,
          first_name: firstName || "Customer",
          last_name: rest.join(" ") || "-",
          phone_number: input.customer.phone ?? "+000000000",
          // Paymob rejects empty strings; NA is its documented placeholder.
          apartment: "NA",
          floor: "NA",
          street: "NA",
          building: "NA",
          shipping_method: "NA",
          postal_code: "NA",
          city: "NA",
          country: "NA",
          state: "NA",
        },
      }),
    });
    if (!keyRes.ok) throw new Error(`Paymob payment key failed: ${keyRes.status}`);
    const { token: paymentToken } = (await keyRes.json()) as { token: string };

    return {
      providerRef: String(order.id),
      redirectUrl: `https://accept.paymob.com/api/acceptance/iframes/${config.iframeId}?payment_token=${paymentToken}`,
      status: "pending",
      raw: { paymob_order_id: order.id },
    };
  }

  async parseWebhook(request: Request, rawBody: string): Promise<WebhookResult | null> {
    const config = readConfig();
    if (!config) return null;

    const url = new URL(request.url);
    const provided = url.searchParams.get("hmac") ?? request.headers.get("x-paymob-hmac");
    if (!provided) return null;

    let payload: { obj?: Record<string, unknown> };
    try {
      payload = JSON.parse(rawBody) as { obj?: Record<string, unknown> };
    } catch {
      return null;
    }
    const obj = payload.obj;
    if (!obj) return null;

    const expected = await hmacSha512Hex(
      HMAC_FIELDS.map((field) => pick(obj, field)).join(""),
      config.hmacSecret,
    );
    if (!timingSafeEqual(expected, provided.toLowerCase())) return null;

    const success = obj.success === true || obj.success === "true";
    const pending = obj.pending === true || obj.pending === "true";
    const paymentId = pick(obj, "order.merchant_order_id");
    if (!paymentId) return null;

    return {
      paymentId,
      providerRef: pick(obj, "order.id"),
      status: success ? "paid" : pending ? "pending" : "failed",
      amountCents: Number(pick(obj, "amount_cents")) || 0,
      raw: obj,
    };
  }
}
