import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import { cartProductsSchema } from "@/lib/validation";

/**
 * POST { productIds: string[] } → { products: [...] }
 * Live product data for the client-side cart (names, prices, tiers, MOQ).
 * Anon RLS client: only ACTIVE products come back, so anything missing from
 * the response is "no longer available". Never cached — prices must be live.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = cartProductsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product list" }, { status: 400 });
  }

  const ip = clientIpFrom(request.headers);
  if (!(await rateLimit(`cartp:${ip}`, 120, 60))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, slug, name, price, moq, stock_status, images, sku, categories(icon), product_price_tiers(min_qty, unit_price)",
    )
    .in("id", parsed.data.productIds);
  if (error) {
    console.error("cart-products query failed:", error.message);
    return NextResponse.json({ error: "Products could not be loaded" }, { status: 500 });
  }

  return NextResponse.json(
    { products: data ?? [] },
    { headers: { "cache-control": "no-store" } },
  );
}
