import Link from "next/link";
import { SelectField, TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { Dictionary } from "@/i18n";
import type { CatalogQuery, CategoryOption, SupplierOption } from "@/lib/catalog-shared";
import { STOCK_STATUSES } from "@/lib/catalog-shared";
import { stockLabel } from "./labels";

/**
 * Filters are a plain GET form: submitting rewrites the URL, so results stay
 * linkable, the back button works, and the whole panel functions with
 * JavaScript disabled. Omitting `page` from the form resets pagination on every
 * change, which is what a buyer expects after narrowing a search.
 *
 * The panel is rendered twice — a `<details>` disclosure below `lg`, a static
 * sidebar above it. Duplicating ~40 elements is cheaper than shipping a
 * JavaScript toggle for a layout concern.
 */
export function FilterPanel(props: FilterFormProps & { activeCount: number }) {
  const { dict, activeCount } = props;

  return (
    <>
      <details className="panel overflow-hidden lg:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink-100 transition-colors duration-200 hover:bg-white/5">
          <span className="flex items-center gap-2">
            <Icon name="search" className="size-4 text-accent-300" />
            {dict.catalog.filters}
            {activeCount > 0 ? (
              <span className="rounded-full bg-accent-500/15 px-2 py-0.5 text-xs font-bold text-accent-200">
                {activeCount}
              </span>
            ) : null}
          </span>
          <Icon name="arrow-right" className="size-4 shrink-0 text-ink-500" />
        </summary>
        <div className="border-t border-white/8 p-4">
          <FilterForm {...props} idPrefix="mf" />
        </div>
      </details>

      <div className="panel sticky top-20 hidden p-5 lg:block">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-300">
          <Icon name="search" className="size-4 text-accent-300" />
          {dict.catalog.filters}
        </h2>
        <FilterForm {...props} idPrefix="df" />
      </div>
    </>
  );
}

export interface FilterFormProps {
  dict: Dictionary;
  query: CatalogQuery;
  categories: CategoryOption[];
  suppliers: SupplierOption[];
  /** Where the form submits — the catalog, or a category landing page. */
  action: string;
  /** Category landing pages fix the category, so the control is dropped. */
  lockCategory?: boolean;
}

function FilterForm({
  dict,
  query,
  categories,
  suppliers,
  action,
  lockCategory = false,
  idPrefix,
}: FilterFormProps & { idPrefix: string }) {
  return (
    <form action={action} method="get" className="flex flex-col gap-4">
      {/* Sort is owned by the toolbar control; carry it through unchanged. */}
      {query.sort !== "relevance" ? (
        <input type="hidden" name="sort" value={query.sort} />
      ) : null}

      <TextField
        id={`${idPrefix}-q`}
        name="q"
        type="search"
        label={dict.catalog.searchLabel}
        placeholder={dict.catalog.searchPlaceholder}
        defaultValue={query.q}
        autoComplete="off"
      />

      {lockCategory ? null : (
        <SelectField
          id={`${idPrefix}-category`}
          name="category"
          label={dict.catalog.category}
          defaultValue={query.category}
        >
          <option value="">{dict.catalog.allCategories}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </SelectField>
      )}

      <SelectField
        id={`${idPrefix}-supplier`}
        name="supplier"
        label={dict.catalog.supplier}
        defaultValue={query.supplier}
      >
        <option value="">{dict.catalog.allSuppliers}</option>
        {suppliers.map((supplier) => (
          <option key={supplier.id} value={supplier.slug}>
            {supplier.name}
          </option>
        ))}
      </SelectField>

      <SelectField
        id={`${idPrefix}-stock`}
        name="stock"
        label={dict.catalog.availability}
        defaultValue={query.stock ?? ""}
      >
        <option value="">{dict.catalog.anyAvailability}</option>
        {STOCK_STATUSES.map((status) => (
          <option key={status} value={status}>
            {stockLabel(status, dict)}
          </option>
        ))}
      </SelectField>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold text-ink-300">
          {dict.catalog.priceRange}
        </legend>
        <div className="flex items-end gap-3">
          <TextField
            id={`${idPrefix}-min`}
            name="min"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            label={dict.catalog.minPrice}
            placeholder="0"
            defaultValue={query.minUsd ?? ""}
            className="tabular-nums"
          />
          <TextField
            id={`${idPrefix}-max`}
            name="max"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            label={dict.catalog.maxPrice}
            placeholder="—"
            defaultValue={query.maxUsd ?? ""}
            className="tabular-nums"
          />
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="submit" className="flex-1">
          {dict.catalog.applyFilters}
        </Button>
        <Link
          href={action}
          className="inline-flex min-h-11 cursor-pointer items-center rounded-xl px-3 text-sm font-medium text-ink-400 transition-colors duration-200 hover:bg-white/5 hover:text-ink-100"
        >
          {dict.catalog.clearFilters}
        </Link>
      </div>
    </form>
  );
}
