import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUser, isAdminUser, auditLog } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { PROOF_BUCKET, detectImage, sanitizeFilename } from "@/lib/proof-file";
import { PROOF_MAX_BYTES, PROOF_MIMES } from "@/lib/validation";

/**
 * POST multipart: the OWNER attaches a payment proof on the customer's behalf.
 *
 * Useful for the common case where a buyer sends the transfer screenshot over
 * WhatsApp/Telegram instead of uploading it. Unlike the customer route this one
 * takes no Turnstile and no tracking token (admin session is the credential),
 * accepts any order status, and never changes the order state or emails
 * anybody — status changes stay an explicit, separate action.
 */

const orderIdSchema = z.string().uuid();
const decisionSchema = z.enum(["pending", "approved", "rejected"]);

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user || !(await isAdminUser(user.id))) {
    // Match requireAdmin(): never reveal that an admin resource exists.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id: orderId } = await ctx.params;
  if (!orderIdSchema.safeParse(orderId).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  const service = supabaseService();
  const { data: order } = await service
    .from("orders")
    .select("id, order_ref")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const decision = decisionSchema.safeParse(form.get("status") ?? "approved");
  if (!decision.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const note = String(form.get("note") ?? "").trim().slice(0, 500);

  const file = form.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: "Attach a screenshot image." }, { status: 400 });
  }
  if (file.size > PROOF_MAX_BYTES) {
    return NextResponse.json(
      { error: "The image is too large (max 4 MB). Compress it and retry." },
      { status: 413 },
    );
  }
  if (!(PROOF_MIMES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: "Only JPG, PNG or WebP images are accepted." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImage(bytes);
  if (!detected) {
    return NextResponse.json(
      { error: "That file is not a valid image — upload the screenshot itself." },
      { status: 400 },
    );
  }

  const storagePath = `${orderId}/${crypto.randomUUID()}.${detected.ext}`;
  const { error: uploadError } = await service.storage
    .from(PROOF_BUCKET)
    .upload(storagePath, bytes, { contentType: detected.mime });
  if (uploadError) {
    console.error("admin proof upload failed:", uploadError.message);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  const reviewed = decision.data !== "pending";
  const { data: inserted, error: rowError } = await service
    .from("payment_proofs")
    .insert({
      order_id: orderId,
      storage_path: storagePath,
      mime: detected.mime,
      size_bytes: bytes.length,
      original_filename: sanitizeFilename(file.name),
      status: decision.data,
      review_reason: note || (reviewed ? "Attached by the store owner" : null),
      reviewed_by: reviewed ? user.id : null,
      reviewed_at: reviewed ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (rowError || !inserted) {
    console.error("admin payment_proofs insert failed:", rowError?.message);
    await service.storage.from(PROOF_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  await auditLog(user.id, "proof.admin_upload", "payment_proofs", inserted.id as string, {
    order_id: orderId,
    order_ref: order.order_ref,
    status: decision.data,
    size_bytes: bytes.length,
  });

  return NextResponse.json({ ok: true, proofId: inserted.id });
}
