/** Domain types mirroring supabase/migrations/0001_init.sql. */

export type StockStatus = "in_stock" | "out_of_stock" | "confirm_availability";
export type OrderStatus =
  | "awaiting_payment"
  | "awaiting_verification"
  | "paid"
  | "fulfilled"
  | "cancelled";
export type ProofStatus = "pending" | "approved" | "rejected";
export type InvoiceKind = "preliminary" | "final";
export type EmailStatus = "pending" | "sent" | "failed";
export type PaymentKind = "instapay" | "wallet" | "bank";
export type ActorKind = "customer" | "admin" | "system";

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  sort: number;
}

export interface Brand {
  id: string;
  slug: string;
  name: string;
}

export interface Product {
  id: string;
  sku: string;
  slug: string;
  name: string;
  original_title: string;
  description: string | null;
  brand_id: string | null;
  category_id: string | null;
  price: number; // numeric(12,2) as JS number; convert via toPiasters(String(x))
  stock_status: StockStatus;
  moq: number;
  active: boolean;
  needs_review: boolean;
  review_reason: string | null;
  category_inferred: boolean;
  brand_inferred: boolean;
  images: string[];
  source_duplicate_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProductPriceTier {
  id: string;
  product_id: string;
  min_qty: number;
  unit_price: number;
}

export interface CustomerProfile {
  user_id: string;
  full_name: string;
  phone: string | null;
  company_name: string | null;
  tax_id: string | null;
  governorate: string | null;
  address: string | null;
}

export interface PaymentMethod {
  id: string;
  kind: PaymentKind;
  label: string;
  number: string;
  display_name: string | null;
  qr_path: string | null;
  instructions: string | null;
  active: boolean;
  sort: number;
  /** Whole-EGP order minimum for this method to be offered (0 = always). */
  min_order_egp: number;
}

export interface Order {
  id: string;
  order_ref: string;
  tracking_token: string;
  customer_id: string;
  status: OrderStatus;
  payment_method_id: string | null;
  payment_method_label: string;
  customer_name: string;
  // Contact/delivery fields are not collected on this site — shipping is done
  // on an external platform after payment. They stay null here.
  phone: string | null;
  email: string;
  company_name: string | null;
  tax_id: string | null;
  governorate: string | null;
  address: string | null;
  subtotal: number;
  adjustment_total: number;
  total: number;
  currency: string;
  customer_note: string | null;
  admin_note: string | null;
  /** Reserved column (shipping now happens off-site); unused by the app. */
  shipping_submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name_snapshot: string;
  sku_snapshot: string | null;
  unit_price: number;
  qty: number;
  amount: number;
  is_custom: boolean;
}

export interface OrderStatusHistoryEntry {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  actor: ActorKind;
  actor_id: string | null;
  reason: string | null;
  created_at: string;
}

export interface PaymentProof {
  id: string;
  order_id: string;
  storage_path: string;
  mime: string;
  size_bytes: number;
  original_filename: string | null;
  status: ProofStatus;
  review_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  order_id: string;
  kind: InvoiceKind;
  pdf_path: string;
  generated_at: string;
}

export interface EmailEvent {
  id: string;
  order_id: string | null;
  kind: string;
  recipient: string;
  subject: string | null;
  status: EmailStatus;
  error: string | null;
  provider_message_id: string | null;
  attempts: number;
  dedupe_key: string | null;
  created_at: string;
}

export interface SellerInfo {
  name: string;
  tax_id: string;
  address: string;
}

export interface DeliverySettings {
  message: string;
  regions: string;
  time: string;
  fee_note: string;
}

export interface OrderingSettings {
  min_order_egp: number;
  currency: string;
  vat_note: string;
}

export interface ContactSettings {
  phone: string;
  whatsapp: string;
  email: string;
  telegram: string;
  facebook: string;
  instagram: string;
}

export interface BrandingSettings {
  store_name: string;
  tagline: string;
  primary_color: string;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: "Awaiting Payment",
  awaiting_verification: "Awaiting Verification",
  paid: "Paid",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  in_stock: "In Stock",
  out_of_stock: "Out of Stock",
  confirm_availability: "Availability confirmed after ordering",
};

/** Legal admin-driven status transitions (server enforces). */
// "Paid" is the last status HDML tracks: after payment is verified the customer
// completes the order + shipping on an external platform and a courier delivers,
// so HDML never sees "fulfilled". The enum value is kept (legacy) but unreachable.
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  awaiting_payment: ["awaiting_verification", "cancelled"],
  awaiting_verification: ["paid", "awaiting_payment", "cancelled"],
  paid: ["cancelled"],
  fulfilled: [],
  cancelled: [],
};
