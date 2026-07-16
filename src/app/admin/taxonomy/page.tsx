import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import type { Brand, Category } from "@/lib/db-types";
import { ActionForm } from "@/components/admin/action-form";
import { Card, PageHeader } from "@/components/admin/ui";
import {
  deleteBrandAction,
  deleteCategoryAction,
  saveBrandAction,
  saveCategoryAction,
} from "@/server/actions/admin/taxonomy";

export const metadata = { title: "Categories & Brands" };

const inputCls =
  "h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none";

/** One paged scan of products → usage counts for both maps (no N+1 counts). */
async function usageCounts(): Promise<{
  byCategory: Map<string, number>;
  byBrand: Map<string, number>;
}> {
  const service = supabaseService();
  const byCategory = new Map<string, number>();
  const byBrand = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await service
      .from("products")
      .select("category_id, brand_id")
      .range(from, from + 999);
    if (error) {
      console.error("usage counts failed:", error.message);
      break;
    }
    for (const r of (data ?? []) as Array<{ category_id: string | null; brand_id: string | null }>) {
      if (r.category_id) byCategory.set(r.category_id, (byCategory.get(r.category_id) ?? 0) + 1);
      if (r.brand_id) byBrand.set(r.brand_id, (byBrand.get(r.brand_id) ?? 0) + 1);
    }
    if (!data || data.length < 1000) break;
  }
  return { byCategory, byBrand };
}

export default async function AdminTaxonomyPage() {
  await requireAdmin();
  const service = supabaseService();

  const [{ data: cats }, { data: brandRows }] = await Promise.all([
    service.from("categories").select("id, slug, name, icon, sort").order("sort").order("name"),
    service.from("brands").select("id, slug, name").order("name"),
  ]);
  const categories = (cats ?? []) as Category[];
  const brands = (brandRows ?? []) as Brand[];

  const { byCategory: catCounts, byBrand: brandCounts } = await usageCounts();

  return (
    <div className="rise-in">
      <PageHeader
        title="Categories & Brands"
        description="Entities with products cannot be deleted. Renames apply immediately; slugs stay stable."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {/* ------------------------------------------------ categories */}
        <Card title={`Categories (${categories.length})`}>
          <ActionForm
            action={saveCategoryAction}
            submitLabel="Add category"
            resetOnSuccess
            className="mb-4 flex flex-wrap items-end gap-2 border-b border-gray-100 pb-4"
          >
            <div className="min-w-40 flex-1">
              <label htmlFor="new-cat-name" className="mb-1 block text-xs font-medium text-gray-600">
                Name
              </label>
              <input id="new-cat-name" name="name" required minLength={2} maxLength={80} className={`${inputCls} w-full`} />
            </div>
            <div className="w-28">
              <label htmlFor="new-cat-icon" className="mb-1 block text-xs font-medium text-gray-600">
                Icon key
              </label>
              <input id="new-cat-icon" name="icon" maxLength={40} placeholder="charger" className={`${inputCls} w-full`} />
            </div>
            <div className="w-20">
              <label htmlFor="new-cat-sort" className="mb-1 block text-xs font-medium text-gray-600">
                Sort
              </label>
              <input id="new-cat-sort" name="sort" type="number" min={0} max={1000} defaultValue={0} className={`${inputCls} w-full`} />
            </div>
          </ActionForm>

          <ul className="space-y-3">
            {categories.map((c) => {
              const count = catCounts.get(c.id) ?? 0;
              return (
                <li key={c.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs text-gray-400">
                    <span>
                      /{c.slug} · {count.toLocaleString("en-US")} product(s)
                    </span>
                    {count === 0 && (
                      <ActionForm
                        action={deleteCategoryAction}
                        submitLabel="Delete"
                        submitVariant="ghost"
                        submitClassName="text-red-600 hover:bg-red-50"
                        confirmMessage={`Delete category "${c.name}"?`}
                        hideMessage
                      >
                        <input type="hidden" name="id" value={c.id} />
                      </ActionForm>
                    )}
                  </div>
                  <ActionForm
                    action={saveCategoryAction}
                    submitLabel="Save"
                    submitVariant="outline"
                    className="flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="categoryId" value={c.id} />
                    <div className="min-w-36 flex-1">
                      <label htmlFor={`cat-name-${c.id}`} className="sr-only">
                        Category name
                      </label>
                      <input
                        id={`cat-name-${c.id}`}
                        name="name"
                        defaultValue={c.name}
                        required
                        minLength={2}
                        maxLength={80}
                        className={`${inputCls} w-full`}
                      />
                    </div>
                    <div className="w-28">
                      <label htmlFor={`cat-icon-${c.id}`} className="sr-only">
                        Icon key
                      </label>
                      <input
                        id={`cat-icon-${c.id}`}
                        name="icon"
                        defaultValue={c.icon ?? ""}
                        maxLength={40}
                        placeholder="icon"
                        className={`${inputCls} w-full`}
                      />
                    </div>
                    <div className="w-20">
                      <label htmlFor={`cat-sort-${c.id}`} className="sr-only">
                        Sort
                      </label>
                      <input
                        id={`cat-sort-${c.id}`}
                        name="sort"
                        type="number"
                        min={0}
                        max={1000}
                        defaultValue={c.sort}
                        className={`${inputCls} w-full`}
                      />
                    </div>
                  </ActionForm>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-gray-400">
            Icon keys map to the placeholder art (case, charger, earbuds, cable, keyboard, speaker,
            storage, phone, router, tablet, computer, watch, camera, tv, gamepad, battery,
            smarthome, bag, box).
          </p>
        </Card>

        {/* ------------------------------------------------ brands */}
        <Card title={`Brands (${brands.length})`}>
          <ActionForm
            action={saveBrandAction}
            submitLabel="Add brand"
            resetOnSuccess
            className="mb-4 flex flex-wrap items-end gap-2 border-b border-gray-100 pb-4"
          >
            <div className="min-w-40 flex-1">
              <label htmlFor="new-brand-name" className="mb-1 block text-xs font-medium text-gray-600">
                Name
              </label>
              <input id="new-brand-name" name="name" required minLength={1} maxLength={80} className={`${inputCls} w-full`} />
            </div>
          </ActionForm>

          <ul className="max-h-[42rem] space-y-2 overflow-y-auto pr-1">
            {brands.map((b) => {
              const count = brandCounts.get(b.id) ?? 0;
              return (
                <li key={b.id} className="rounded-lg border border-gray-200 p-2.5">
                  <ActionForm
                    action={saveBrandAction}
                    submitLabel="Save"
                    submitVariant="outline"
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="brandId" value={b.id} />
                    <label htmlFor={`brand-name-${b.id}`} className="sr-only">
                      Brand name
                    </label>
                    <input
                      id={`brand-name-${b.id}`}
                      name="name"
                      defaultValue={b.name}
                      required
                      minLength={1}
                      maxLength={80}
                      className={`${inputCls} min-w-32 flex-1`}
                    />
                    <span className="text-xs text-gray-400">{count.toLocaleString("en-US")}</span>
                  </ActionForm>
                  {count === 0 && (
                    <div className="mt-1.5">
                      <ActionForm
                        action={deleteBrandAction}
                        submitLabel="Delete"
                        submitVariant="ghost"
                        submitClassName="text-red-600 hover:bg-red-50"
                        confirmMessage={`Delete brand "${b.name}"?`}
                        hideMessage
                      >
                        <input type="hidden" name="id" value={b.id} />
                      </ActionForm>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
