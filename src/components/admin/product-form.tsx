"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publicImageUrl } from "@/lib/image-url";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { saveProductAction } from "@/server/actions/admin/products";

export interface ProductFormInitial {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  price: string; // decimal string "1499.50"
  categoryId: string | null;
  brandId: string | null;
  stockStatus: "in_stock" | "out_of_stock" | "confirm_availability";
  moq: number;
  active: boolean;
  needsReview: boolean;
  reviewReason: string | null;
  images: string[];
  tiers: Array<{ minQty: number; unitPrice: string }>;
}

interface Option {
  id: string;
  name: string;
}

interface TierRow {
  key: number;
  minQty: string;
  unitPrice: string;
}

const PRICE_RE = /^\d+(\.\d{1,2})?$/;

export function ProductForm({
  product,
  categories,
  brands,
}: {
  product: ProductFormInitial | null;
  categories: Option[];
  brands: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const keyRef = useRef(1000);

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product?.price ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [brandId, setBrandId] = useState(product?.brandId ?? "");
  const [stockStatus, setStockStatus] = useState<ProductFormInitial["stockStatus"]>(
    product?.stockStatus ?? "confirm_availability",
  );
  const [moq, setMoq] = useState(String(product?.moq ?? 1));
  const [active, setActive] = useState(product?.active ?? true);
  const [needsReview, setNeedsReview] = useState(product?.needsReview ?? false);
  const [regenerateSlug, setRegenerateSlug] = useState(false);
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [tiers, setTiers] = useState<TierRow[]>(
    (product?.tiers ?? []).map((t, i) => ({ key: i, minQty: String(t.minQty), unitPrice: t.unitPrice })),
  );

  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function addImageUrl() {
    const url = imageUrl.trim();
    if (!url) return;
    if (images.length >= 10) {
      setMessage("Maximum 10 images");
      setOk(false);
      return;
    }
    setImages([...images, url]);
    setImageUrl("");
  }

  async function uploadImage(file: File) {
    if (images.length >= 10) {
      setMessage("Maximum 10 images");
      setOk(false);
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (product?.id) fd.append("productId", product.id);
      const res = await fetch("/api/admin/upload-image", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
      if (!res.ok || !json.path) throw new Error(json.error ?? `Upload failed (${res.status})`);
      setImages((prev) => [...prev, json.path!]);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed");
      setOk(false);
    } finally {
      setUploading(false);
    }
  }

  function validateClient(): string | null {
    if (name.trim().length < 3) return "Name must be at least 3 characters";
    if (!PRICE_RE.test(price.trim())) return "Price must be a number like 1499.50";
    for (const t of tiers) {
      const qty = Number.parseInt(t.minQty, 10);
      if (!Number.isInteger(qty) || qty < 1) return "Every tier needs a min quantity ≥ 1";
      if (!PRICE_RE.test(t.unitPrice.trim())) return "Every tier needs a valid unit price";
    }
    return null;
  }

  function submit() {
    const clientError = validateClient();
    if (clientError) {
      setMessage(clientError);
      setOk(false);
      return;
    }
    setMessage(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await saveProductAction({
        productId: product?.id,
        regenerateSlug: product ? regenerateSlug : undefined,
        name: name.trim(),
        description: description.trim(),
        price: price.trim(),
        categoryId: categoryId || null,
        brandId: brandId || null,
        stockStatus,
        moq: Number.parseInt(moq, 10) || 1,
        active,
        needsReview,
        images,
        tiers: tiers.map((t) => ({
          minQty: Number.parseInt(t.minQty, 10),
          unitPrice: t.unitPrice.trim(),
        })),
      });
      setOk(result.ok);
      setMessage(result.message ?? (result.ok ? "Saved." : "Save failed"));
      setFieldErrors(result.errors ?? {});
      if (result.ok && !product && result.id) {
        router.push(`/admin/products/${result.id}`);
      }
    });
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <TextField
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={3}
            maxLength={300}
            error={fieldErrors.name}
          />
          <TextAreaField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={5000}
            error={fieldErrors.description}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Price (EGP)"
              required
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="1499.50"
              error={fieldErrors.price}
            />
            <TextField
              label="Minimum order qty"
              type="number"
              min={1}
              max={100000}
              required
              value={moq}
              onChange={(e) => setMoq(e.target.value)}
              error={fieldErrors.moq}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">— none —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
            <SelectField label="Brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              <option value="">— none —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </SelectField>
          </div>
          <SelectField
            label="Stock status"
            value={stockStatus}
            onChange={(e) => setStockStatus(e.target.value as ProductFormInitial["stockStatus"])}
          >
            <option value="in_stock">In stock</option>
            <option value="out_of_stock">Out of stock</option>
            <option value="confirm_availability">Availability confirmed after ordering</option>
          </SelectField>

          <div className="space-y-2 rounded-lg border border-gray-200 p-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="size-4 accent-brand-700"
              />
              <span>Active (visible in the store)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={needsReview}
                onChange={(e) => setNeedsReview(e.target.checked)}
                className="size-4 accent-brand-700"
              />
              <span>Needs review</span>
            </label>
            {product?.reviewReason && (
              <p className="text-xs text-amber-700">
                <span className="font-medium">Review reason:</span> {product.reviewReason}
                {!needsReview && " (cleared on save)"}
              </p>
            )}
          </div>

          {product && (
            <div className="space-y-1 rounded-lg border border-gray-200 p-3 text-sm">
              <p className="text-xs text-gray-400">
                SKU: <span className="font-mono text-gray-600">{product.sku}</span>
              </p>
              <p className="text-xs text-gray-400">
                Slug: <span className="font-mono text-gray-600">{product.slug}</span>
              </p>
              <label className="mt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={regenerateSlug}
                  onChange={(e) => setRegenerateSlug(e.target.checked)}
                  className="size-4 accent-brand-700"
                />
                <span>Regenerate slug from name on save (changes the public URL)</span>
              </label>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* ---------------- images ---------------- */}
          <fieldset className="rounded-lg border border-gray-200 p-3">
            <legend className="px-1 text-sm font-medium text-gray-700">
              Images ({images.length}/10)
            </legend>
            {images.length > 0 && (
              <ul className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {images.map((img, i) => (
                  <li key={`${img}-${i}`} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={publicImageUrl(img)}
                      alt={`Product image ${i + 1}`}
                      className="aspect-square w-full rounded-lg border border-gray-200 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setImages(images.filter((_, j) => j !== i))}
                      aria-label={`Remove image ${i + 1}`}
                      className="absolute right-1 top-1 rounded-md bg-white/90 px-1.5 py-0.5 text-xs font-medium text-red-600 shadow hover:bg-white"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://… or bucket path"
                aria-label="Image URL"
                className="h-9 w-full flex-1 rounded-lg border border-gray-300 px-3 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none"
              />
              <Button type="button" variant="outline" size="sm" className="h-9" onClick={addImageUrl}>
                Add URL
              </Button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-brand-200 px-3 text-sm font-medium text-brand-800 hover:bg-brand-50">
                {uploading ? <Spinner className="mr-2 size-3.5" /> : null}
                Upload image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadImage(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <span className="text-xs text-gray-400">JPEG/PNG/WebP, max 4 MB</span>
            </div>
          </fieldset>

          {/* ---------------- price tiers ---------------- */}
          <fieldset className="rounded-lg border border-gray-200 p-3">
            <legend className="px-1 text-sm font-medium text-gray-700">
              Wholesale price tiers
            </legend>
            {tiers.length === 0 && (
              <p className="mb-2 text-xs text-gray-400">
                No tiers — everyone pays the base price. Tiers apply when qty ≥ min qty.
              </p>
            )}
            <ul className="space-y-2">
              {tiers.map((t, i) => (
                <li key={t.key} className="flex items-end gap-2">
                  <div className="w-28">
                    <label
                      htmlFor={`tier-qty-${t.key}`}
                      className="mb-1 block text-xs font-medium text-gray-600"
                    >
                      Min qty
                    </label>
                    <input
                      id={`tier-qty-${t.key}`}
                      type="number"
                      min={1}
                      value={t.minQty}
                      onChange={(e) =>
                        setTiers(tiers.map((x, j) => (j === i ? { ...x, minQty: e.target.value } : x)))
                      }
                      className="h-9 w-full rounded-lg border border-gray-300 px-2 text-sm focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label
                      htmlFor={`tier-price-${t.key}`}
                      className="mb-1 block text-xs font-medium text-gray-600"
                    >
                      Unit price (EGP)
                    </label>
                    <input
                      id={`tier-price-${t.key}`}
                      inputMode="decimal"
                      value={t.unitPrice}
                      onChange={(e) =>
                        setTiers(
                          tiers.map((x, j) => (j === i ? { ...x, unitPrice: e.target.value } : x)),
                        )
                      }
                      placeholder="1399.00"
                      className="h-9 w-full rounded-lg border border-gray-300 px-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 text-red-600 hover:bg-red-50"
                    onClick={() => setTiers(tiers.filter((_, j) => j !== i))}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={tiers.length >= 10}
              onClick={() =>
                setTiers([...tiers, { key: keyRef.current++, minQty: "", unitPrice: "" }])
              }
            >
              Add tier
            </Button>
            <p className="mt-2 text-xs text-gray-400">
              Saving replaces all tiers for this product.
            </p>
          </fieldset>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
        <Button type="submit" disabled={pending || uploading}>
          {pending && <Spinner className="size-4 border-white/40 border-t-white" />}
          {product ? "Save product" : "Create product"}
        </Button>
        {message && (
          <p role={ok ? "status" : "alert"} className={ok ? "text-sm text-emerald-700" : "text-sm text-red-600"}>
            {message}
          </p>
        )}
        {needsReview && <Badge tone="amber">Will stay in the review queue</Badge>}
      </div>
      {Object.keys(fieldErrors).length > 0 && (
        <ul className="space-y-0.5 text-xs text-red-600">
          {Object.entries(fieldErrors).map(([field, msg]) => (
            <li key={field}>
              {field === "_form" ? "" : `${field}: `}
              {msg}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
