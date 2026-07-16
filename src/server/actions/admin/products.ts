"use server";

/**
 * Admin product mutations: create/update (with price tiers), quick toggles,
 * needs-review resolution, delete/deactivate, and the CSV importer.
 *
 * Every action authorizes with requireAdmin() BEFORE touching
 * supabaseService(), and records an audit entry for mutations.
 */

import { refresh } from "next/cache";
import { requireAdmin, auditLog } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { parseCsv } from "@/lib/csv";
import { MoneyError, piastersToDecimalString, toPiasters } from "@/lib/money";
import { productSku, slugify } from "@/lib/slug";
import type { StockStatus } from "@/lib/db-types";
import {
  adminCsvTextSchema,
  adminProductIdSchema,
  adminProductSaveSchema,
  adminProductToggleSchema,
  parseOrErrors,
} from "@/lib/validation";
import {
  failure,
  fdBool,
  fdString,
  success,
  type ActionResult,
  type ActionState,
} from "@/server/actions/admin/action-result";

const STOCK_STATUSES: StockStatus[] = ["in_stock", "out_of_stock", "confirm_availability"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find a free slug by probing the DB (excluding the product being edited). */
async function uniqueSlug(base: string, excludeProductId?: string): Promise<string> {
  const service = supabaseService();
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    let query = service.from("products").select("id").eq("slug", candidate);
    if (excludeProductId) query = query.neq("id", excludeProductId);
    const { data } = await query.limit(1);
    if (!data || data.length === 0) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// Save (create / update) with tier replacement
// ---------------------------------------------------------------------------

export interface SaveProductResult extends ActionResult {
  id?: string;
}

export async function saveProductAction(input: unknown): Promise<SaveProductResult> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(adminProductSaveSchema, input);
  if (!parsed.ok) return { ok: false, message: "Please fix the highlighted fields", errors: parsed.errors };
  const d = parsed.data;

  let priceDecimal: string;
  let tierRows: Array<{ min_qty: number; unit_price: string }>;
  try {
    priceDecimal = piastersToDecimalString(toPiasters(d.price));
    const byMinQty = new Map<number, string>();
    for (const t of d.tiers) {
      byMinQty.set(t.minQty, piastersToDecimalString(toPiasters(t.unitPrice)));
    }
    tierRows = [...byMinQty.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([min_qty, unit_price]) => ({ min_qty, unit_price }));
  } catch (e) {
    return { ok: false, message: e instanceof MoneyError ? e.message : "Invalid price" };
  }

  const service = supabaseService();
  const fields = {
    name: d.name,
    description: d.description || null,
    price: priceDecimal,
    category_id: d.categoryId,
    brand_id: d.brandId,
    stock_status: d.stockStatus,
    moq: d.moq,
    active: d.active,
    needs_review: d.needsReview,
    review_reason: d.needsReview ? undefined : null, // clear reason when review resolved
  };

  let productId = d.productId;
  if (productId) {
    // -- update --------------------------------------------------------------
    const { data: existing } = await service
      .from("products")
      .select("id, slug, name")
      .eq("id", productId)
      .maybeSingle();
    if (!existing) return { ok: false, message: "Product not found" };

    const update: Record<string, unknown> = { ...fields, images: d.images };
    if (update.review_reason === undefined) delete update.review_reason;
    if (d.regenerateSlug) {
      update.slug = await uniqueSlug(slugify(d.name), productId);
    }
    const { error } = await service.from("products").update(update).eq("id", productId);
    if (error) return { ok: false, message: `Update failed: ${error.message}` };

    await auditLog(admin.id, "product.update", "products", productId, {
      name: d.name,
      price: priceDecimal,
      active: d.active,
      tiers: tierRows.length,
    });
  } else {
    // -- create ---------------------------------------------------------------
    let sku = productSku(d.name, priceDecimal);
    for (let i = 0; i < 5; i++) {
      const { data } = await service.from("products").select("id").eq("sku", sku).limit(1);
      if (!data || data.length === 0) break;
      sku = `${sku}X`;
    }
    const slug = await uniqueSlug(slugify(d.name));
    const insert: Record<string, unknown> = {
      ...fields,
      review_reason: null,
      sku,
      slug,
      original_title: d.name,
      images: d.images,
      category_inferred: false,
      brand_inferred: false,
    };
    const { data: created, error } = await service
      .from("products")
      .insert(insert)
      .select("id")
      .single();
    if (error || !created) {
      return { ok: false, message: `Create failed: ${error?.message ?? "no row returned"}` };
    }
    productId = created.id as string;

    await auditLog(admin.id, "product.create", "products", productId, {
      name: d.name,
      sku,
      price: priceDecimal,
    });
  }

  // -- replace price tiers ----------------------------------------------------
  const { error: delError } = await service
    .from("product_price_tiers")
    .delete()
    .eq("product_id", productId);
  if (delError) return { ok: false, message: `Tier replace failed: ${delError.message}` };
  if (tierRows.length > 0) {
    const { error: insError } = await service
      .from("product_price_tiers")
      .insert(tierRows.map((t) => ({ ...t, product_id: productId })));
    if (insError) return { ok: false, message: `Tier insert failed: ${insError.message}` };
  }

  refresh();
  return { ok: true, id: productId, message: d.productId ? "Product saved." : "Product created." };
}

// ---------------------------------------------------------------------------
// Quick actions
// ---------------------------------------------------------------------------

export async function toggleProductActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(adminProductToggleSchema, {
    productId: fdString(formData, "productId"),
    active: fdBool(formData, "active"),
  });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);
  const { productId, active } = parsed.data;

  const service = supabaseService();
  const { error } = await service.from("products").update({ active }).eq("id", productId);
  if (error) return failure(`Update failed: ${error.message}`);

  await auditLog(admin.id, "product.toggle_active", "products", productId, { active });
  refresh();
  return success(active ? "Product activated." : "Product deactivated.");
}

/** Resolve a needs_review product without edits: activate as-is. */
export async function activateProductAsIsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(adminProductIdSchema, {
    productId: fdString(formData, "productId"),
  });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);
  const { productId } = parsed.data;

  const service = supabaseService();
  const { error } = await service
    .from("products")
    .update({ active: true, needs_review: false, review_reason: null })
    .eq("id", productId);
  if (error) return failure(`Update failed: ${error.message}`);

  await auditLog(admin.id, "product.activate_reviewed", "products", productId, {});
  refresh();
  return success("Product activated as-is.");
}

export interface DeleteProductResult extends ActionResult {
  deleted?: boolean;
  deactivated?: boolean;
}

/**
 * Hard-delete when no order ever referenced the product; otherwise only
 * deactivate (order item snapshots must keep resolving their source row).
 */
export async function deleteProductAction(input: unknown): Promise<DeleteProductResult> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(adminProductIdSchema, input);
  if (!parsed.ok) return { ok: false, message: "Invalid input", errors: parsed.errors };
  const { productId } = parsed.data;

  const service = supabaseService();
  const { data: product } = await service
    .from("products")
    .select("id, name, sku")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { ok: false, message: "Product not found" };

  const { count } = await service
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);

  if ((count ?? 0) > 0) {
    const { error } = await service.from("products").update({ active: false }).eq("id", productId);
    if (error) return { ok: false, message: `Deactivate failed: ${error.message}` };
    await auditLog(admin.id, "product.deactivate_referenced", "products", productId, {
      order_items: count,
      sku: product.sku,
    });
    refresh();
    return {
      ok: true,
      deactivated: true,
      message: `This product appears in ${count} order line(s), so it was deactivated instead of deleted.`,
    };
  }

  const { error } = await service.from("products").delete().eq("id", productId);
  if (error) return { ok: false, message: `Delete failed: ${error.message}` };

  await auditLog(admin.id, "product.delete", "products", productId, {
    name: product.name,
    sku: product.sku,
  });
  refresh();
  return { ok: true, deleted: true, message: "Product deleted." };
}

// ---------------------------------------------------------------------------
// CSV import (parse/preview + confirm)
// ---------------------------------------------------------------------------

const CSV_COLUMNS = [
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
] as const;
type CsvColumn = (typeof CSV_COLUMNS)[number];

const MAX_IMPORT_ROWS = 5000;

interface RowError {
  line: number;
  message: string;
}

interface PlannedCreate {
  line: number;
  sku: string;
  name: string;
  priceDecimal: string;
  categoryId: string | null;
  brandName: string | null;
  stockStatus: StockStatus;
  moq: number;
  active: boolean;
  needsReview: boolean;
  reviewReason: string | null;
  images: string[];
}

interface PlannedUpdate {
  line: number;
  productId: string;
  sku: string;
  name: string;
  /** Resolved DB column → value patch. brand_name deferred via brandName. */
  patch: Record<string, unknown>;
  brandName: string | null | undefined; // undefined = not provided
}

interface ImportPlan {
  totalRows: number;
  ignoredColumns: string[];
  creates: PlannedCreate[];
  updates: PlannedUpdate[];
  errors: RowError[];
}

export interface CsvPreviewRow {
  line: number;
  action: "create" | "update" | "error";
  sku: string;
  name: string;
  price: string;
  note: string;
}

export interface CsvParseReport extends ActionResult {
  totalRows?: number;
  createCount?: number;
  updateCount?: number;
  errorCount?: number;
  rowErrors?: RowError[];
  ignoredColumns?: string[];
  preview?: CsvPreviewRow[];
}

function parseBool(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(v)) return true;
  if (["false", "0", "no", "n"].includes(v)) return false;
  return null;
}

/** Build the full import plan. Shared by preview and confirm. */
async function analyzeCsv(text: string): Promise<ImportPlan | { fatal: string }> {
  const rows = parseCsv(text);
  if (rows.length < 2) return { fatal: "The file has no data rows" };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const colIndex = new Map<CsvColumn, number>();
  const ignoredColumns: string[] = [];
  header.forEach((h, i) => {
    if ((CSV_COLUMNS as readonly string[]).includes(h)) colIndex.set(h as CsvColumn, i);
    else if (h) ignoredColumns.push(h);
  });
  if (!colIndex.has("sku") && !(colIndex.has("name") && colIndex.has("price"))) {
    return { fatal: 'The header must contain "sku" (updates) or "name" and "price" (creates)' };
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return { fatal: `Too many rows: ${dataRows.length} (max ${MAX_IMPORT_ROWS})` };
  }

  const service = supabaseService();

  // Lookup maps: categories by slug, existing products by sku, existing slugs.
  const { data: cats, error: catError } = await service.from("categories").select("id, slug");
  if (catError) return { fatal: `Failed to load categories: ${catError.message}` };
  const categoryBySlug = new Map((cats ?? []).map((c) => [c.slug as string, c.id as string]));

  const productBySku = new Map<string, { id: string; name: string }>();
  const existingSlugs = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await service
      .from("products")
      .select("id, sku, slug, name")
      .range(from, from + 999);
    if (error) return { fatal: `Failed to load products: ${error.message}` };
    for (const r of data ?? []) {
      productBySku.set(r.sku as string, { id: r.id as string, name: r.name as string });
      existingSlugs.add(r.slug as string);
    }
    if (!data || data.length < 1000) break;
  }

  const get = (row: string[], col: CsvColumn): string => {
    const i = colIndex.get(col);
    return i === undefined ? "" : (row[i] ?? "").trim();
  };

  const errors: RowError[] = [];
  const creates: PlannedCreate[] = [];
  const updates: PlannedUpdate[] = [];
  const batchSkus = new Set<string>();

  dataRows.forEach((row, idx) => {
    const line = idx + 2; // 1-based + header
    const sku = get(row, "sku");

    try {
      if (sku) {
        // ---- update by SKU ----
        const existing = productBySku.get(sku);
        if (!existing) {
          errors.push({ line, message: `SKU ${sku} not found — remove it to create a new product` });
          return;
        }
        const patch: Record<string, unknown> = {};
        let brandName: string | null | undefined;

        const name = get(row, "name");
        if (name) {
          if (name.length < 3) throw new Error("Name too short");
          patch.name = name;
        }
        const price = get(row, "price");
        if (price) patch.price = piastersToDecimalString(toPiasters(price));
        const categorySlug = get(row, "category_slug");
        if (categorySlug) {
          const catId = categoryBySlug.get(categorySlug);
          if (!catId) throw new Error(`Unknown category slug "${categorySlug}"`);
          patch.category_id = catId;
        }
        if (colIndex.has("brand_name")) {
          const b = get(row, "brand_name");
          brandName = b ? b : undefined; // empty = leave as-is
        }
        const stock = get(row, "stock_status");
        if (stock) {
          if (!(STOCK_STATUSES as string[]).includes(stock)) {
            throw new Error(`Invalid stock_status "${stock}"`);
          }
          patch.stock_status = stock;
        }
        const moq = get(row, "moq");
        if (moq) {
          const n = Number.parseInt(moq, 10);
          if (!Number.isInteger(n) || n < 1) throw new Error(`Invalid moq "${moq}"`);
          patch.moq = n;
        }
        const active = get(row, "active");
        if (active) {
          const b = parseBool(active);
          if (b === null) throw new Error(`Invalid active "${active}"`);
          patch.active = b;
        }
        const needsReview = get(row, "needs_review");
        if (needsReview) {
          const b = parseBool(needsReview);
          if (b === null) throw new Error(`Invalid needs_review "${needsReview}"`);
          patch.needs_review = b;
          if (!b) patch.review_reason = null;
        }
        const reviewReason = get(row, "review_reason");
        if (reviewReason) patch.review_reason = reviewReason;
        const images = get(row, "images");
        if (images) {
          patch.images = images.split("|").map((s) => s.trim()).filter(Boolean).slice(0, 10);
        }

        if (Object.keys(patch).length === 0 && brandName === undefined) {
          errors.push({ line, message: `SKU ${sku}: no columns to update` });
          return;
        }
        updates.push({ line, productId: existing.id, sku, name: name || existing.name, patch, brandName });
      } else {
        // ---- create ----
        const name = get(row, "name");
        const price = get(row, "price");
        if (!name || name.length < 3) throw new Error("Name is required (min 3 characters)");
        if (!price) throw new Error("Price is required for new products");
        const priceDecimal = piastersToDecimalString(toPiasters(price));

        const newSku = productSku(name, priceDecimal);
        if (productBySku.has(newSku)) {
          throw new Error(`Already exists as SKU ${newSku} — add the sku column to update it`);
        }
        if (batchSkus.has(newSku)) throw new Error(`Duplicate of an earlier row (SKU ${newSku})`);
        batchSkus.add(newSku);

        const categorySlug = get(row, "category_slug");
        let categoryId: string | null = null;
        if (categorySlug) {
          categoryId = categoryBySlug.get(categorySlug) ?? null;
          if (!categoryId) throw new Error(`Unknown category slug "${categorySlug}"`);
        }
        const stock = get(row, "stock_status") || "confirm_availability";
        if (!(STOCK_STATUSES as string[]).includes(stock)) {
          throw new Error(`Invalid stock_status "${stock}"`);
        }
        const moqRaw = get(row, "moq");
        const moq = moqRaw ? Number.parseInt(moqRaw, 10) : 1;
        if (!Number.isInteger(moq) || moq < 1) throw new Error(`Invalid moq "${moqRaw}"`);

        const needsReview = parseBool(get(row, "needs_review") || "false");
        if (needsReview === null) throw new Error("Invalid needs_review value");
        const activeRaw = get(row, "active");
        const active = activeRaw ? parseBool(activeRaw) : !needsReview;
        if (active === null) throw new Error(`Invalid active "${activeRaw}"`);

        creates.push({
          line,
          sku: newSku,
          name,
          priceDecimal,
          categoryId,
          brandName: get(row, "brand_name") || null,
          stockStatus: stock as StockStatus,
          moq,
          active,
          needsReview,
          reviewReason: needsReview ? get(row, "review_reason") || "flagged_in_import" : null,
          images: get(row, "images").split("|").map((s) => s.trim()).filter(Boolean).slice(0, 10),
        });
      }
    } catch (e) {
      errors.push({
        line,
        message: e instanceof Error || e instanceof MoneyError ? (e as Error).message : String(e),
      });
    }
  });

  return { totalRows: dataRows.length, ignoredColumns, creates, updates, errors };
}

/** Dry-run parse: header + row validation and a 20-row preview. No writes. */
export async function parseProductsCsvAction(input: unknown): Promise<CsvParseReport> {
  await requireAdmin();

  const parsed = parseOrErrors(adminCsvTextSchema, input);
  if (!parsed.ok) return { ok: false, message: "Invalid file", errors: parsed.errors };

  const plan = await analyzeCsv(parsed.data.csv);
  if ("fatal" in plan) return { ok: false, message: plan.fatal };

  const preview: CsvPreviewRow[] = [];
  const byLine = [
    ...plan.creates.map((c) => ({
      line: c.line,
      action: "create" as const,
      sku: c.sku,
      name: c.name,
      price: c.priceDecimal,
      note: c.needsReview ? `needs review: ${c.reviewReason ?? ""}` : "",
    })),
    ...plan.updates.map((u) => ({
      line: u.line,
      action: "update" as const,
      sku: u.sku,
      name: u.name,
      price: typeof u.patch.price === "string" ? u.patch.price : "",
      note: `updates: ${Object.keys(u.patch).join(", ") || "brand"}`,
    })),
    ...plan.errors.map((e) => ({
      line: e.line,
      action: "error" as const,
      sku: "",
      name: "",
      price: "",
      note: e.message,
    })),
  ].sort((a, b) => a.line - b.line);
  preview.push(...byLine.slice(0, 20));

  return {
    ok: true,
    totalRows: plan.totalRows,
    createCount: plan.creates.length,
    updateCount: plan.updates.length,
    errorCount: plan.errors.length,
    rowErrors: plan.errors.slice(0, 100),
    ignoredColumns: plan.ignoredColumns,
    preview,
  };
}

export interface CsvImportResult extends ActionResult {
  created?: number;
  updated?: number;
  rowErrors?: RowError[];
}

/** Execute the import: create missing brands, insert creates, apply updates. */
export async function importProductsCsvAction(input: unknown): Promise<CsvImportResult> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(adminCsvTextSchema, input);
  if (!parsed.ok) return { ok: false, message: "Invalid file", errors: parsed.errors };

  const plan = await analyzeCsv(parsed.data.csv);
  if ("fatal" in plan) return { ok: false, message: plan.fatal };

  const service = supabaseService();
  const errors: RowError[] = [...plan.errors];

  // 1. Ensure brands exist.
  const brandNames = new Set<string>();
  for (const c of plan.creates) if (c.brandName) brandNames.add(c.brandName);
  for (const u of plan.updates) if (u.brandName) brandNames.add(u.brandName);
  if (brandNames.size > 0) {
    const rows = [...brandNames].map((name) => ({ name, slug: slugify(name, 60) }));
    const { error } = await service
      .from("brands")
      .upsert(rows, { onConflict: "slug", ignoreDuplicates: true });
    if (error) return { ok: false, message: `Brand upsert failed: ${error.message}` };
  }
  const { data: allBrands, error: brandError } = await service.from("brands").select("id, name");
  if (brandError) return { ok: false, message: `Brand load failed: ${brandError.message}` };
  const brandByName = new Map((allBrands ?? []).map((b) => [b.name as string, b.id as string]));

  // 2. Record the batch first so products can reference it.
  const { data: batch } = await service
    .from("import_batches")
    .insert({
      source: "admin-csv-import",
      stats: {
        total_rows: plan.totalRows,
        planned_creates: plan.creates.length,
        planned_updates: plan.updates.length,
        row_errors: plan.errors.length,
      },
    })
    .select("id")
    .single();

  // 3. Slug assignment for creates (unique against DB + batch).
  const usedSlugs = new Set<string>();
  {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await service.from("products").select("slug").range(from, from + 999);
      if (error) return { ok: false, message: `Slug load failed: ${error.message}` };
      for (const r of data ?? []) usedSlugs.add(r.slug as string);
      if (!data || data.length < 1000) break;
    }
  }

  let created = 0;
  const insertRows = plan.creates.map((c) => {
    const base = slugify(c.name);
    let slug = base;
    for (let n = 2; usedSlugs.has(slug); n++) slug = `${base}-${n}`;
    usedSlugs.add(slug);
    return {
      line: c.line,
      row: {
        sku: c.sku,
        slug,
        name: c.name,
        original_title: c.name,
        price: c.priceDecimal,
        category_id: c.categoryId,
        brand_id: c.brandName ? (brandByName.get(c.brandName) ?? null) : null,
        stock_status: c.stockStatus,
        moq: c.moq,
        active: c.active,
        needs_review: c.needsReview,
        review_reason: c.reviewReason,
        category_inferred: false,
        brand_inferred: false,
        images: c.images,
        import_batch_id: batch?.id ?? null,
        source_duplicate_count: 1,
      },
    };
  });
  for (let i = 0; i < insertRows.length; i += 500) {
    const chunk = insertRows.slice(i, i + 500);
    const { error } = await service.from("products").insert(chunk.map((e) => e.row));
    if (error) {
      // Fall back to row-by-row so one bad row doesn't sink the chunk.
      for (const e of chunk) {
        const { error: rowError } = await service.from("products").insert(e.row);
        if (rowError) errors.push({ line: e.line, message: rowError.message });
        else created++;
      }
    } else {
      created += chunk.length;
    }
  }

  // 4. Updates (per-row so failures stay isolated).
  let updated = 0;
  for (const u of plan.updates) {
    const patch = { ...u.patch };
    if (u.brandName !== undefined && u.brandName !== null) {
      patch.brand_id = brandByName.get(u.brandName) ?? null;
    }
    const { error } = await service.from("products").update(patch).eq("id", u.productId);
    if (error) errors.push({ line: u.line, message: `SKU ${u.sku}: ${error.message}` });
    else updated++;
  }

  // 5. Final batch stats + audit.
  if (batch?.id) {
    await service
      .from("import_batches")
      .update({
        stats: {
          total_rows: plan.totalRows,
          created,
          updated,
          errors: errors.length,
        },
      })
      .eq("id", batch.id);
  }
  await auditLog(admin.id, "products.import_csv", "import_batches", batch?.id ?? undefined, {
    total_rows: plan.totalRows,
    created,
    updated,
    errors: errors.length,
  });

  refresh();
  return {
    ok: true,
    created,
    updated,
    rowErrors: errors.slice(0, 100),
    message: `Import finished: ${created} created, ${updated} updated, ${errors.length} error(s).`,
  };
}
