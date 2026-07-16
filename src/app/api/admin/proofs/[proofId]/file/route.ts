import { NextResponse, type NextRequest } from "next/server";
import { getUser, isAdminUser } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";

/**
 * GET /api/admin/proofs/[proofId]/file
 * Admin-only redirect to a short-lived signed URL for the private
 * payment-proof image (usable directly as an <img src>).
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ proofId: string }> },
): Promise<Response> {
  const user = await getUser();
  if (!user || !(await isAdminUser(user.id))) {
    // Match requireAdmin(): do not reveal that an admin resource exists.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { proofId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(proofId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const service = supabaseService();
  const { data: proof } = await service
    .from("payment_proofs")
    .select("storage_path")
    .eq("id", proofId)
    .maybeSingle();
  if (!proof?.storage_path) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await service.storage
    .from("payment-proofs")
    .createSignedUrl(proof.storage_path as string, 600);
  if (error || !data?.signedUrl) {
    console.error("proof signed URL failed:", error?.message);
    return NextResponse.json({ error: "File unavailable" }, { status: 502 });
  }

  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: { "cache-control": "private, no-store" },
  });
}
