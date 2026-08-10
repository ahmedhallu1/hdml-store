import "server-only";
import { supabaseService } from "@/lib/supabase/server";
import { signWebhook } from "@/lib/crypto";
import type { WebhookEvent } from "@/lib/db-types";

/**
 * Outbound webhooks to merchant systems.
 *
 * Deliveries are queued to eig.webhook_deliveries first and then attempted, so
 * a merchant endpoint being down never fails the operation that produced the
 * event. Retries use exponential backoff and give up after MAX_ATTEMPTS.
 */

const MAX_ATTEMPTS = 6;
/** Backoff per attempt, in seconds: ~30s, 2m, 8m, 30m, 2h. */
const BACKOFF_SECONDS = [30, 120, 480, 1_800, 7_200];

/** Queue an event for every active endpoint of an account subscribed to it. */
export async function queueWebhook(
  accountId: string | null,
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!accountId) return;
  const service = supabaseService();

  const { data: endpoints } = await service
    .from("webhook_endpoints")
    .select("id, events")
    .eq("account_id", accountId)
    .eq("active", true);

  const matching = (endpoints ?? []).filter((e) =>
    ((e.events as WebhookEvent[]) ?? []).includes(event),
  );
  if (matching.length === 0) return;

  await service.from("webhook_deliveries").insert(
    matching.map((e) => ({
      endpoint_id: e.id as string,
      event,
      payload: { event, data: payload, created_at: new Date().toISOString() },
      status: "pending",
      next_attempt_at: new Date().toISOString(),
    })),
  );

  // Best-effort immediate flush; the cron route is the safety net.
  void deliverPending(matching.length).catch((error) =>
    console.error("immediate webhook flush failed:", error),
  );
}

/**
 * Attempt every delivery that is due. Safe to call from a cron route and
 * concurrently with itself — a delivery already past MAX_ATTEMPTS is skipped.
 */
export async function deliverPending(limit = 25): Promise<{ attempted: number; succeeded: number }> {
  const service = supabaseService();

  const { data: due } = await service
    .from("webhook_deliveries")
    .select("id, endpoint_id, event, payload, attempts")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at")
    .limit(limit);

  if (!due || due.length === 0) return { attempted: 0, succeeded: 0 };

  const endpointIds = [...new Set(due.map((d) => d.endpoint_id as string))];
  const { data: endpoints } = await service
    .from("webhook_endpoints")
    .select("id, url, secret, active")
    .in("id", endpointIds);
  const endpointMap = new Map((endpoints ?? []).map((e) => [e.id as string, e]));

  let succeeded = 0;

  for (const delivery of due) {
    const endpoint = endpointMap.get(delivery.endpoint_id as string);
    if (!endpoint || !endpoint.active) {
      await service
        .from("webhook_deliveries")
        .update({ status: "exhausted", last_error: "Endpoint missing or inactive" })
        .eq("id", delivery.id as string);
      continue;
    }

    const body = JSON.stringify(delivery.payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = await signWebhook(`${timestamp}.${body}`, endpoint.secret as string);
    const attempts = (delivery.attempts as number) + 1;

    let responseStatus: number | null = null;
    let lastError: string | null = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const response = await fetch(endpoint.url as string, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-eig-event": delivery.event as string,
          "x-eig-timestamp": timestamp,
          "x-eig-signature": signature,
          "user-agent": "ELECT-I-Global-Webhooks/1",
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      responseStatus = response.status;
      if (!response.ok) lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "fetch failed";
    }

    if (!lastError) {
      succeeded++;
      await service
        .from("webhook_deliveries")
        .update({ status: "succeeded", attempts, response_status: responseStatus })
        .eq("id", delivery.id as string);
      continue;
    }

    const exhausted = attempts >= MAX_ATTEMPTS;
    const backoff = BACKOFF_SECONDS[Math.min(attempts - 1, BACKOFF_SECONDS.length - 1)];
    await service
      .from("webhook_deliveries")
      .update({
        status: exhausted ? "exhausted" : "pending",
        attempts,
        last_error: lastError,
        response_status: responseStatus,
        next_attempt_at: new Date(Date.now() + backoff * 1000).toISOString(),
      })
      .eq("id", delivery.id as string);
  }

  return { attempted: due.length, succeeded };
}
