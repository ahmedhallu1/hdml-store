import { NextResponse, type NextRequest } from "next/server";
import { getUser, isAdminUser } from "@/lib/auth";
import { getInvoiceSignedUrl } from "@/lib/invoice-service";

/**
 * GET /api/admin/orders/[id]/invoice?kind=preliminary|final
 * Admin-only redirect to the signed PDF URL (opened in a new tab).
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getUser();
  if (!user || !(await isAdminUser(user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await ctx.params;
  const kind = req.nextUrl.searchParams.get("kind");
  if (!/^[0-9a-f-]{36}$/i.test(id) || (kind !== "preliminary" && kind !== "final")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = await getInvoiceSignedUrl(id, kind);
  if (!url) {
    return new Response("Invoice not generated yet — use Regenerate on the order page.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.redirect(url, {
    status: 302,
    headers: { "cache-control": "private, no-store" },
  });
}
