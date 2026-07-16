import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/server";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendOrderEmail } from "@/lib/invoice-service";
import { PROOF_MAX_BYTES, PROOF_MIMES, proofUploadFieldsSchema } from "@/lib/validation";
import type { Order } from "@/lib/db-types";

/**
 * POST multipart: payment-proof screenshot upload.
 * Authorization = possession of the order's tracking token (checked against
 * the order row before any service-role write). Files are content-sniffed —
 * the stored mime/extension come from magic bytes, never from the filename.
 */

const PROOF_BUCKET = "payment-proofs";
const orderIdSchema = z.string().uuid();

/** Identify the image type from its magic bytes. */
function detectImage(bytes: Uint8Array): { mime: (typeof PROOF_MIMES)[number]; ext: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) {
    return { mime: "image/png", ext: "png" };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // WEBP
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

/** Keep a readable original filename without control chars / path tricks. */
function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[/\\]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120);
  return cleaned || "proof";
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await ctx.params;
  if (!orderIdSchema.safeParse(orderId).success) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  const fields = proofUploadFieldsSchema.safeParse({
    token: form.get("token"),
    turnstileToken: form.get("turnstileToken"),
  });
  if (!fields.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // --- Authorization: the token must match this exact order -----------------
  const service = supabaseService();
  const { data: orderRow } = await service
    .from("orders")
    .select("id, tracking_token, status, customer_id")
    .eq("id", orderId)
    .maybeSingle();
  const order = orderRow as Pick<Order, "id" | "tracking_token" | "status" | "customer_id"> | null;
  if (!order || order.tracking_token !== fields.data.token) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status !== "awaiting_payment" && order.status !== "awaiting_verification") {
    return NextResponse.json(
      { error: "This order is no longer accepting payment proofs." },
      { status: 409 },
    );
  }

  const ip = clientIpFrom(request.headers);
  if (!(await verifyTurnstile(fields.data.turnstileToken, ip))) {
    return NextResponse.json(
      { error: "Human verification failed. Please try again." },
      { status: 403 },
    );
  }
  if (!(await rateLimit(`proof:${orderId}`, 10, 3600))) {
    return NextResponse.json({ error: "Too many uploads for this order." }, { status: 429 });
  }
  if (!(await rateLimit(`proof-ip:${ip}`, 20, 3600))) {
    return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  }

  // --- File validation -------------------------------------------------------
  const file = form.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: "Attach a screenshot image." }, { status: 400 });
  }
  if (file.size > PROOF_MAX_BYTES) {
    return NextResponse.json(
      { error: "The image is too large (max 4 MB). Please compress it and retry." },
      { status: 413 },
    );
  }
  if (!(PROOF_MIMES as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      { error: "Only JPG, PNG or WebP images are accepted." },
      { status: 400 },
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImage(bytes);
  if (!detected) {
    return NextResponse.json(
      { error: "The file does not look like a valid image. Please upload the screenshot itself." },
      { status: 400 },
    );
  }

  // --- Store (path/extension from DETECTED type, never the filename) --------
  const storagePath = `${orderId}/${crypto.randomUUID()}.${detected.ext}`;
  const { error: uploadError } = await service.storage
    .from(PROOF_BUCKET)
    .upload(storagePath, bytes, { contentType: detected.mime });
  if (uploadError) {
    console.error("proof upload failed:", uploadError.message);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  const { error: rowError } = await service.from("payment_proofs").insert({
    order_id: orderId,
    storage_path: storagePath,
    mime: detected.mime,
    size_bytes: bytes.length,
    original_filename: sanitizeFilename(file.name),
    status: "pending",
  });
  if (rowError) {
    console.error("payment_proofs insert failed:", rowError.message);
    // Best-effort cleanup so no orphan file lingers in the private bucket.
    await service.storage.from(PROOF_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  // --- awaiting_payment → awaiting_verification ------------------------------
  if (order.status === "awaiting_payment") {
    const { error: statusError } = await service
      .from("orders")
      .update({ status: "awaiting_verification" })
      .eq("id", orderId)
      .eq("status", "awaiting_payment"); // no-op if an admin moved it meanwhile
    if (statusError) {
      console.error("order status update failed:", statusError.message);
    } else {
      const { error: historyError } = await service.from("order_status_history").insert({
        order_id: orderId,
        from_status: "awaiting_payment",
        to_status: "awaiting_verification",
        actor: "customer",
        actor_id: order.customer_id,
        reason: "Payment proof uploaded",
      });
      if (historyError) console.error("status history insert failed:", historyError.message);
    }
  }

  // --- Preliminary receipt email (must never fail the upload) ----------------
  let emailSent = false;
  try {
    const result = await sendOrderEmail(orderId, "preliminary");
    emailSent = result.sent;
    if (!result.sent) console.error("preliminary email failed:", result.error);
  } catch (e) {
    console.error("preliminary email threw:", e);
  }

  // Note: the storage path is intentionally NOT returned.
  return NextResponse.json({ ok: true, emailSent });
}
