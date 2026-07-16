"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { cn } from "@/lib/cn";

type SortValue = "newest" | "price_asc" | "price_desc" | "name_asc";

export interface CatalogFilterValues {
  q?: string;
  category?: string;
  brand?: string;
  min?: number;
  max?: number;
  sort: SortValue;
}

interface Option {
  slug: string;
  name: string;
}

/**
 * Filter bar for the catalog listing. It is a plain GET form (works with no
 * JavaScript); the search input additionally live-updates the URL with a
 * 300ms debounce for instant results.
 */
export function CatalogFilters({
  action,
  categories,
  brands,
  values,
  hideCategory = false,
}: {
  /** Path the form submits to, e.g. "/catalog" or "/category/cables". */
  action: string;
  categories: Option[];
  brands: Option[];
  values: CatalogFilterValues;
  hideCategory?: boolean;
}) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Remounting on non-q value changes keeps the uncontrolled fields in sync
  // after "Clear filters" / soft navigations, without stealing focus while
  // the visitor types in the search box.
  const syncKey = [values.category ?? "", values.brand ?? "", values.min ?? "", values.max ?? "", values.sort].join("|");

  function onSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
    const form = event.currentTarget.form;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!form) return;
      const sp = new URLSearchParams();
      for (const [key, value] of new FormData(form).entries()) {
        if (typeof value === "string" && value.trim() !== "") sp.set(key, value.trim());
      }
      const qs = sp.toString();
      router.replace(qs ? `${action}?${qs}` : action, { scroll: false });
    }, 300);
  }

  return (
    <form
      key={syncKey}
      action={action}
      method="get"
      className={cn(
        "grid grid-cols-2 items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-4",
        hideCategory ? "lg:grid-cols-7" : "lg:grid-cols-8",
      )}
    >
      <div className="col-span-2">
        <TextField
          label="Search"
          type="search"
          name="q"
          defaultValue={values.q ?? ""}
          placeholder="Search products…"
          autoComplete="off"
          onChange={onSearchChange}
        />
      </div>

      {!hideCategory && (
        <SelectField label="Category" name="category" defaultValue={values.category ?? ""}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </SelectField>
      )}

      <SelectField label="Brand" name="brand" defaultValue={values.brand ?? ""}>
        <option value="">All brands</option>
        {brands.map((b) => (
          <option key={b.slug} value={b.slug}>
            {b.name}
          </option>
        ))}
      </SelectField>

      <TextField
        label="Min price (EGP)"
        type="number"
        name="min"
        min={0}
        step={1}
        inputMode="numeric"
        defaultValue={values.min !== undefined ? String(values.min) : ""}
        placeholder="0"
      />

      <TextField
        label="Max price (EGP)"
        type="number"
        name="max"
        min={0}
        step={1}
        inputMode="numeric"
        defaultValue={values.max !== undefined ? String(values.max) : ""}
        placeholder="Any"
      />

      <SelectField label="Sort by" name="sort" defaultValue={values.sort}>
        <option value="newest">Newest first</option>
        <option value="price_asc">Price: low to high</option>
        <option value="price_desc">Price: high to low</option>
        <option value="name_asc">Name: A to Z</option>
      </SelectField>

      <Button type="submit" className="w-full">
        Apply
      </Button>
    </form>
  );
}
