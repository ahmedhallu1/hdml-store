import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { ensureInvoice, getInvoiceSignedUrl } from "@/lib/invoice-service";
import type { InvoiceKind, Order } from "@/lib/db-types";

/**
 * GET ?kind=preliminary|final&token=... → 307 to a short-lived signed PDF URL.
 * Authorization: the order's tracking token OR the signed-in order owner.
 * Availability rules (re-checked here, not just in the UI):
 *   - final: only once the order is paid/fulfilled
 *   - preliminary: once a proof exists or the order reached verification
 */

const querySchema = z.object({
  orderId: z.string().uuid(),
  kind: z.enum(["preliminary", "final"]),
});

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await ctx.params;
  const parsed = querySchema.safeParse({
    orderId,
    kind: request.nextUrl.searchParams.get("kind"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const kind: InvoiceKind = parsed.data.kind;
  const token = request.nextUrl.searchParams.get("token");

  const service = supabaseService();
  const { data: orderRow } = await service
    .from("orders")
    .select("id, tracking_token, customer_id, status")
    .eq("id", orderId)
    .maybeSingle();
  const order = orderRow as Pick<Order, "id" | "tracking_token" | "customer_id" | "status"> | null;
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // --- Authorization: capability token OR signed-in owner -------------------
  let authorized = Boolean(token) && token === order.tracking_token;
  if (!authorized) {
    const user = await getUser();
    authorized = Boolean(user) && user?.id === order.customer_id;
  }
  if (!authorized) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // --- Availability rules ----------------------------------------------------
  if (kind === "final") {
    if (order.status !== "paid" && order.status !== "fulfilled") {
      return NextResponse.json(
        { error: "The final receipt is issued after payment verification." },
        { status: 404 },
      );
    }
  } else {
    const statusOk = ["awaiting_verification", "paid", "fulfilled"].includes(order.status);
    if (!statusOk) {
      const { count } = await service
        .from("payment_proofs")
        .select("id", { count: "exact", head: true })
        .eq("order_id", orderId);
      if (!count) {
        return NextResponse.json(
          { error: "The preliminary receipt is available after you upload a payment proof." },
          { status: 404 },
        );
      }
    }
  }

  // --- Signed URL (generate the PDF on first request) -----------------------
  let signedUrl = await getInvoiceSignedUrl(orderId, kind);
  if (!signedUrl) {
    try {
      await ensureInvoice(orderId, kind);
    } catch (e) {
      console.error(`ensureInvoice failed for ${orderId}/${kind}:`, e);
    }
    signedUrl = await getInvoiceSignedUrl(orderId, kind);
  }
  if (!signedUrl) {
    return NextResponse.json(
      { error: "The receipt could not be generated. Please try again shortly." },
      { status: 404 },
    );
  }

  return NextResponse.redirect(signedUrl);
}
