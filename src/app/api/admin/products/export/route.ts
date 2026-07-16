import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { csvRow } from "@/lib/csv";
import { piastersToDecimalString, toPiasters } from "@/lib/money";
import { requireAdminForApi } from "@/app/api/admin/_lib/image-upload";

/**
 * GET /api/admin/products/export
 * Streams the full catalog as CSV (paged internally, 1000 rows per chunk).
 * Columns match the importer so an exported file can be re-imported.
 */

const HEADERS = [
  "sku",
  "slug",
  "name",
  "price",
  "category_slug",
  "brand_name",
  "stock_status",
  "moq",
  "active",
  "needs_review",
  "review_reason",
  "images",
];

interface ExportRow {
  sku: string;
  slug: string;
  name: string;
  price: number;
  stock_status: string;
  moq: number;
  active: boolean;
  needs_review: boolean;
  review_reason: string | null;
  images: string[];
  categories: { slug: string } | null;
  brands: { name: string } | null;
}

export async function GET(): Promise<Response> {
  const adminId = await requireAdminForApi();
  if (!adminId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const service = supabaseService();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(csvRow(HEADERS) + "\r\n"));
        for (let from = 0; ; from += 1000) {
          const { data, error } = await service
            .from("products")
            .select(
              "sku, slug, name, price, stock_status, moq, active, needs_review, review_reason, images, categories(slug), brands(name)",
            )
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, from + 999);
          if (error) throw new Error(error.message);

          const rows = (data ?? []) as unknown as ExportRow[];
          if (rows.length > 0) {
            const chunk = rows
              .map((p) =>
                csvRow([
                  p.sku,
                  p.slug,
                  p.name,
                  piastersToDecimalString(toPiasters(String(p.price))),
                  p.categories?.slug ?? "",
                  p.brands?.name ?? "",
                  p.stock_status,
                  p.moq,
                  p.active,
                  p.needs_review,
                  p.review_reason ?? "",
                  (p.images ?? []).join("|"),
                ]),
              )
              .join("\r\n");
            controller.enqueue(encoder.encode(chunk + "\r\n"));
          }
          if (rows.length < 1000) break;
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="hdml-products-${stamp}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
