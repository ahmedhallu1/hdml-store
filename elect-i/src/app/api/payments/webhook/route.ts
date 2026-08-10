import { activeProvider, settlePayment } from "@/lib/payments";

/**
 * Payment provider callback.
 *
 * The provider adapter verifies the signature and returns null when it does
 * not check out; an unverified callback is dropped with a 400 and never
 * touches a balance. Settlement itself is idempotent, so a provider retrying
 * a delivery is harmless.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  let parsed;
  try {
    parsed = await activeProvider().parseWebhook(request, rawBody);
  } catch (error) {
    console.error("payment webhook parse failed:", error);
    return new Response("invalid", { status: 400 });
  }

  if (!parsed) return new Response("invalid signature", { status: 400 });

  try {
    await settlePayment(parsed.paymentId, parsed.status === "paid" ? "paid" : "failed", parsed.providerRef, parsed.raw);
  } catch (error) {
    console.error("payment settlement failed:", error);
    // 500 asks the provider to retry rather than silently losing the event.
    return new Response("settlement failed", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
