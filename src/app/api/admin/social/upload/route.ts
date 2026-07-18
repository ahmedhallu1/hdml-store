import { NextResponse, type NextRequest } from "next/server";
import { auditLog } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import {
  MAX_UPLOAD_BYTES,
  requireAdminForApi,
  sniffImage,
} from "@/app/api/admin/_lib/image-upload";

/**
 * POST /api/admin/social/upload (multipart: file)
 * Validates magic bytes (jpeg/png/webp, ≤4 MB) and stores the image in the
 * PUBLIC `social-media` bucket under posts/{uuid}.{ext}. Returns the
 * bucket-relative { path } for the post form's hidden imagePath field.
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

  const path = `posts/${crypto.randomUUID()}.${sniffed.ext}`;
  const service = supabaseService();
  const { error } = await service.storage
    .from("social-media")
    .upload(path, bytes, { contentType: sniffed.contentType, upsert: false });
  if (error) {
    return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 502 });
  }

  await auditLog(adminId, "social.image_upload", "social", path, {
    path,
    bytes: file.size,
  });

  return NextResponse.json({ path });
}
