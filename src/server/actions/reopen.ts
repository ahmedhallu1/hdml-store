"use server";

/**
 * Waiting list for when ordering reopens.
 *
 * While `ordering.accepting_orders` is false the storefront stays fully
 * browsable but checkout is closed, so the only thing we can do with an
 * interested buyer is take their email. Public endpoint: Turnstile + rate
 * limited, same as the other unauthenticated writes.
 */

import { headers } from "next/headers";
import { getUser } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { reopenNotifySchema } from "@/lib/validation";

export type ReopenResult = { ok: boolean; message: string };

export async function subscribeToReopen(input: unknown): Promise<ReopenResult> {
  const parsed = reopenNotifySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Please enter a valid email address." };
  }
  const { email, name, phone } = parsed.data;

  const turnstileToken =
    typeof input === "object" && input !== null && "turnstileToken" in input
      ? String((input as { turnstileToken?: unknown }).turnstileToken ?? "")
      : "";

  const ip = clientIpFrom(await headers());
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return { ok: false, message: "Human verification failed. Please try again." };
  }
  if (!(await rateLimit(`reopen-ip:${ip}`, 8, 3600))) {
    return { ok: false, message: "Too many attempts. Please try again later." };
  }

  const user = await getUser();
  const service = supabaseService();

  // Already on the list (and not yet notified) is a success, not an error.
  const { data: existing } = await service
    .from("reopen_notifications")
    .select("id")
    .ilike("email", email)
    .is("notified_at", null)
    .maybeSingle();
  if (existing) {
    return { ok: true, message: "You're already on the list — we'll email you as soon as we reopen." };
  }

  const { error } = await service.from("reopen_notifications").insert({
    email,
    name: name || (user?.user_metadata?.full_name as string | undefined) || null,
    phone: phone || null,
    user_id: user?.id ?? null,
  });
  if (error) {
    // Unique index on (lower(email)) where not yet notified — treat as success.
    if (error.code === "23505") {
      return { ok: true, message: "You're already on the list — we'll email you when we reopen." };
    }
    console.error("reopen_notifications insert failed:", error.message);
    return { ok: false, message: "Something went wrong. Please try again." };
  }

  return { ok: true, message: "Thanks — we'll email you the moment ordering reopens." };
}
