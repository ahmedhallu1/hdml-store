import { z } from "zod";
import { GOVERNORATES, normalizeEgyptMobile } from "@/lib/egypt";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72);

export const egyptMobileSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const normalized = normalizeEgyptMobile(v);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid Egyptian mobile number (e.g. 01012345678)",
      });
      return z.NEVER;
    }
    return normalized;
  });

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: egyptMobileSchema,
  password: passwordSchema,
  companyName: z.string().trim().max(160).optional().or(z.literal("")),
  turnstileToken: z.string().min(1, "Verification failed — please retry"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
  turnstileToken: z.string().min(1, "Verification failed — please retry"),
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: egyptMobileSchema,
  companyName: z.string().trim().max(160).optional().or(z.literal("")),
  taxId: z.string().trim().max(40).optional().or(z.literal("")),
  governorate: z.enum(GOVERNORATES).optional(),
  address: z.string().trim().max(500).optional().or(z.literal("")),
});

export const cartItemSchema = z.object({
  productId: z.string().uuid(),
  qty: z.number().int().min(1).max(100000),
});

export const checkoutSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(200),
  paymentMethodId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  customerName: z.string().trim().min(2).max(120),
  phone: egyptMobileSchema,
  email: emailSchema,
  companyName: z.string().trim().max(160).optional().or(z.literal("")),
  taxId: z.string().trim().max(40).optional().or(z.literal("")),
  governorate: z.enum(GOVERNORATES),
  address: z.string().trim().min(5).max(500),
  customerNote: z.string().trim().max(1000).optional().or(z.literal("")),
  turnstileToken: z.string().min(1, "Verification failed — please retry"),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const PROOF_MAX_BYTES = 4 * 1024 * 1024; // 4 MB after client compression
export const PROOF_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;

export const adminProductSchema = z.object({
  name: z.string().trim().min(3).max(300),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  price: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Price must be a number like 1499.50"),
  categoryId: z.string().uuid().nullable(),
  brandId: z.string().uuid().nullable(),
  stockStatus: z.enum(["in_stock", "out_of_stock", "confirm_availability"]),
  moq: z.number().int().min(1).max(100000),
  active: z.boolean(),
  needsReview: z.boolean(),
  images: z.array(z.string().max(1000)).max(10),
  tiers: z
    .array(
      z.object({
        minQty: z.number().int().min(1).max(1000000),
        unitPrice: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
      }),
    )
    .max(10),
});

export const adminOrderStatusSchema = z.object({
  orderId: z.string().uuid(),
  toStatus: z.enum(["awaiting_payment", "awaiting_verification", "paid", "fulfilled", "cancelled"]),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export const proofReviewSchema = z.object({
  proofId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export const customLineItemSchema = z.object({
  orderId: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  unitPrice: z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
  qty: z.number().int().min(1).max(100000),
});

export const paymentMethodSchema = z.object({
  kind: z.enum(["instapay", "wallet"]),
  label: z.string().trim().min(2).max(80),
  number: z.string().trim().min(5).max(40),
  displayName: z.string().trim().max(120).optional().or(z.literal("")),
  instructions: z.string().trim().max(1000).optional().or(z.literal("")),
  active: z.boolean(),
  sort: z.number().int().min(0).max(1000),
});

// --- Customer accounts / cart / checkout / order tracking (add-only) -------

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const updatePasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

/** POST /api/cart-products body. */
export const cartProductsSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1).max(200),
});

/** orders.tracking_token = encode(gen_random_bytes(24), 'hex') → 48 hex chars. */
export const TRACKING_TOKEN_PATTERN = /^[a-f0-9]{48}$/;

/** Non-file fields of the payment-proof upload form. */
export const proofUploadFieldsSchema = z.object({
  token: z.string().regex(TRACKING_TOKEN_PATTERN, "Invalid tracking token"),
  turnstileToken: z.string().min(1, "Verification failed — please retry"),
});

// ---------------------------------------------------------------------------
// Admin module schemas (additive — owned by the admin dashboard module)
// ---------------------------------------------------------------------------

export const adminProductSaveSchema = adminProductSchema.extend({
  productId: z.string().uuid().optional(),
  regenerateSlug: z.boolean().optional(),
});

export const adminProductToggleSchema = z.object({
  productId: z.string().uuid(),
  active: z.boolean(),
});

export const adminProductIdSchema = z.object({
  productId: z.string().uuid(),
});

export const adminOrderItemRemoveSchema = z.object({
  orderId: z.string().uuid(),
  itemId: z.string().uuid(),
});

export const adminInvoiceActionSchema = z.object({
  orderId: z.string().uuid(),
  kind: z.enum(["preliminary", "final"]),
});

export const adminCategorySaveSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(80),
  icon: z.string().trim().max(40).optional().or(z.literal("")),
  sort: z.coerce.number().int().min(0).max(1000),
});

export const adminBrandSaveSchema = z.object({
  brandId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
});

export const adminEntityDeleteSchema = z.object({
  id: z.string().uuid(),
});

export const adminSellerInfoSchema = z.object({
  name: z.string().trim().min(2).max(160),
  taxId: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
});

export const adminDeliverySettingsSchema = z.object({
  message: z.string().trim().min(2).max(500),
  regions: z.string().trim().max(200).optional().or(z.literal("")),
  time: z.string().trim().max(100).optional().or(z.literal("")),
  feeNote: z.string().trim().max(300).optional().or(z.literal("")),
});

export const adminOrderingSettingsSchema = z.object({
  minOrderEgp: z.coerce.number().int().min(0).max(10000000),
  vatNote: z.string().trim().max(300).optional().or(z.literal("")),
});

export const adminContactSettingsSchema = z.object({
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().max(254).optional().or(z.literal("")),
  facebook: z.string().trim().max(300).optional().or(z.literal("")),
  instagram: z.string().trim().max(300).optional().or(z.literal("")),
});

export const adminPaymentMethodSaveSchema = paymentMethodSchema.extend({
  methodId: z.string().uuid().optional(),
});

export const adminPaymentMethodToggleSchema = z.object({
  methodId: z.string().uuid(),
  active: z.boolean(),
});

export const adminPaymentMethodQrClearSchema = z.object({
  methodId: z.string().uuid(),
});

/** Raw CSV text for the product importer (cap enforced again on rows). */
export const adminCsvTextSchema = z.object({
  csv: z.string().min(1).max(8_000_000),
});

/** Parse a FormData/JSON payload and return typed data or a flat error map. */
export function parseOrErrors<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
): { ok: true; data: z.infer<T> } | { ok: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}
