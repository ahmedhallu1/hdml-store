import { deliverPending } from "@/lib/webhooks";

/**
 * Retry queue for outbound merchant webhooks.
 *
 * Point a Cloudflare Cron Trigger (or any scheduler) at this route every few
 * minutes. Protected by a shared secret so it cannot be driven by strangers.
 */
export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return new Response("cron not configured", { status: 503 });

  const provided = request.headers.get("authorization");
  if (provided !== `Bearer ${expected}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const result = await deliverPending(50);
  return Response.json(result);
}
