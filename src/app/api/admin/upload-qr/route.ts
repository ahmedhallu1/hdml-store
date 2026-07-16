import { NextResponse, type NextRequest } from "next/server";
import { auditLog } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import {
  MAX_UPLOAD_BYTES,
  requireAdminForApi,
  sniffImage,
} from "@/app/api/admin/_lib/image-upload";

/**
 * POST /api/admin/upload-qr (multipart: file, methodId)
 * Stores a payment-method QR image in the public `site-assets` bucket at
 * payment-qr/{methodId}.{ext} and saves qr_path on the method.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const adminId = await requireAdminForApi();
  if (!adminId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const methodId = form.get("methodId");
  if (typeof methodId !== "string" || !/^[0-9a-f-]{36}$/i.test(methodId)) {
    return NextResponse.json({ error: "Invalid methodId" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File must be between 1 byte and 4 MB" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImage(bytes);
  if (!sniffed) {
    return NextResponse.json(
      { error: "Only JPEG, PNG or WebP images are accepted" },
      { status: 400 },
    );
  }

  const service = supabaseService();
  const { data: method } = await service
    .from("payment_methods")
    .select("id")
    .eq("id", methodId)
    .maybeSingle();
  if (!method) return NextResponse.json({ error: "Payment method not found" }, { status: 404 });

  const path = `payment-qr/${methodId}.${sniffed.ext}`;
  const { error } = await service.storage
    .from("site-assets")
    .upload(path, bytes, { contentType: sniffed.contentType, upsert: true });
  if (error) {
    return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 502 });
  }

  const { error: updateError } = await service
    .from("payment_methods")
    .update({ qr_path: path })
    .eq("id", methodId);
  if (updateError) {
    return NextResponse.json({ error: `Save failed: ${updateError.message}` }, { status: 502 });
  }

  await auditLog(adminId, "payment_method.qr_upload", "payment_methods", methodId, {
    path,
    bytes: file.size,
  });

  return NextResponse.json({ path });
}
