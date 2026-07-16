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
