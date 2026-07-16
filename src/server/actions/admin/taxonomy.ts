"use server";

/**
 * Admin taxonomy mutations: categories and brands.
 * Deletes are blocked while any product references the entity.
 */

import { refresh } from "next/cache";
import { requireAdmin, auditLog } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";
import {
  adminBrandSaveSchema,
  adminCategorySaveSchema,
  adminEntityDeleteSchema,
  parseOrErrors,
} from "@/lib/validation";
import {
  failure,
  fdString,
  success,
  type ActionState,
} from "@/server/actions/admin/action-result";

async function uniqueTaxonomySlug(
  table: "categories" | "brands",
  base: string,
  excludeId?: string,
): Promise<string> {
  const service = supabaseService();
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    let query = service.from(table).select("id").eq("slug", candidate);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.limit(1);
    if (!data || data.length === 0) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function productCount(column: "category_id" | "brand_id", id: string): Promise<number> {
  const service = supabaseService();
  const { count } = await service
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq(column, id);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function saveCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(adminCategorySaveSchema, {
    categoryId: fdString(formData, "categoryId") || undefined,
    name: fdString(formData, "name"),
    icon: fdString(formData, "icon"),
    sort: fdString(formData, "sort") || "0",
  });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);
  const { categoryId, name, icon, sort } = parsed.data;

  const service = supabaseService();
  if (categoryId) {
    const { error } = await service
      .from("categories")
      .update({ name, icon: icon || null, sort })
      .eq("id", categoryId);
    if (error) return failure(`Update failed: ${error.message}`);
    await auditLog(admin.id, "category.update", "categories", categoryId, { name, icon, sort });
    refresh();
    return success("Category saved.");
  }

  const slug = await uniqueTaxonomySlug("categories", slugify(name, 60));
  const { data, error } = await service
    .from("categories")
    .insert({ name, slug, icon: icon || null, sort })
    .select("id")
    .single();
  if (error || !data) return failure(`Create failed: ${error?.message ?? "no row"}`);
  await auditLog(admin.id, "category.create", "categories", data.id as string, { name, slug });
  refresh();
  return success(`Category "${name}" created.`);
}

export async function deleteCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(adminEntityDeleteSchema, { id: fdString(formData, "id") });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);
  const { id } = parsed.data;

  const count = await productCount("category_id", id);
  if (count > 0) {
    return failure(`Cannot delete: ${count} product(s) still use this category`);
  }

  const service = supabaseService();
  const { data: cat } = await service.from("categories").select("name").eq("id", id).maybeSingle();
  const { error } = await service.from("categories").delete().eq("id", id);
  if (error) return failure(`Delete failed: ${error.message}`);
  await auditLog(admin.id, "category.delete", "categories", id, { name: cat?.name ?? null });
  refresh();
  return success("Category deleted.");
}

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export async function saveBrandAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(adminBrandSaveSchema, {
    brandId: fdString(formData, "brandId") || undefined,
    name: fdString(formData, "name"),
  });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);
  const { brandId, name } = parsed.data;

  const service = supabaseService();
  if (brandId) {
    const { error } = await service.from("brands").update({ name }).eq("id", brandId);
    if (error) return failure(`Update failed: ${error.message}`);
    await auditLog(admin.id, "brand.update", "brands", brandId, { name });
    refresh();
    return success("Brand saved.");
  }

  const slug = await uniqueTaxonomySlug("brands", slugify(name, 60));
  const { data, error } = await service
    .from("brands")
    .insert({ name, slug })
    .select("id")
    .single();
  if (error || !data) return failure(`Create failed: ${error?.message ?? "no row"}`);
  await auditLog(admin.id, "brand.create", "brands", data.id as string, { name, slug });
  refresh();
  return success(`Brand "${name}" created.`);
}

export async function deleteBrandAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = parseOrErrors(adminEntityDeleteSchema, { id: fdString(formData, "id") });
  if (!parsed.ok) return failure("Invalid input", parsed.errors);
  const { id } = parsed.data;

  const count = await productCount("brand_id", id);
  if (count > 0) {
    return failure(`Cannot delete: ${count} product(s) still use this brand`);
  }

  const service = supabaseService();
  const { data: brand } = await service.from("brands").select("name").eq("id", id).maybeSingle();
  const { error } = await service.from("brands").delete().eq("id", id);
  if (error) return failure(`Delete failed: ${error.message}`);
  await auditLog(admin.id, "brand.delete", "brands", id, { name: brand?.name ?? null });
  refresh();
  return success("Brand deleted.");
}
