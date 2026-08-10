/** Domain types mirroring supabase/migrations/0007_eig_init.sql. */

import type { Tier } from "@/lib/tiers";

export type TierStatus = "active" | "past_due" | "cancelled" | "expired";
export type StockStatus = "in_stock" | "made_to_order" | "out_of_stock" | "confirm_availability";
export type VerificationLevel =
  | "unverified"
  | "verified"
  | "audited"
  | "premium_manufacturer"
  | "authorized_distributor";

export type OrderStatus =
  | "draft"
  | "awaiting_payment"
  | "paid"
  | "awaiting_recipient"
  | "claimed"
  | "ready_to_ship"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed" | "refunded";
export type WalletTxnKind =
  | "topup"
  | "charge"
  | "refund"
  | "adjustment"
  | "credit_draw"
  | "credit_repay";
export type ApiScope =
  | "orders:read"
  | "orders:write"
  | "wallet:read"
  | "quotes:write"
  | "catalog:read";
export type WebhookEvent =
  | "order.created"
  | "order.claimed"
  | "order.shipped"
  | "order.delivered"
  | "order.cancelled"
  | "wallet.low_balance";
export type RfqStatus = "open" | "quoted" | "accepted" | "declined" | "expired";
export type ActorKind = "buyer" | "merchant" | "admin" | "system" | "recipient";

/**
 * Allowed status transitions. Every status change is validated against this
 * map before it is written, and recorded in eig.order_status_history.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ["awaiting_payment", "cancelled"],
  awaiting_payment: ["paid", "cancelled"],
  // Prepaid on-behalf orders branch to awaiting_recipient; direct orders go
  // straight to ready_to_ship because the address is already known.
  paid: ["awaiting_recipient", "ready_to_ship", "cancelled", "refunded"],
  awaiting_recipient: ["claimed", "cancelled", "refunded"],
  claimed: ["ready_to_ship", "cancelled", "refunded"],
  ready_to_ship: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export interface Account {
  user_id: string;
  email: string;
  full_name: string;
  company_name: string | null;
  company_country: string | null;
  phone: string | null;
  vat_number: string | null;
  locale: string;
  tier: Tier;
  tier_status: TierStatus;
  tier_started_at: string | null;
  tier_expires_at: string | null;
  /** numeric(14,2) as JS number; convert via toCents(String(x)). */
  wallet_balance: number;
  credit_limit: number;
  credit_used: number;
  /** Shown on prepaid claim pages; Elite tier only. */
  brand_display_name: string | null;
  brand_logo_url: string | null;
  suspended: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  slug: string;
  name: string;
  country: string | null;
  city: string | null;
  verification: VerificationLevel;
  response_rate: number | null;
  lead_time_days: number | null;
  description: string | null;
  active: boolean;
}

export interface Category {
  id: string;
  slug: string;
  name_en: string;
  name_zh: string;
  group_key: string;
  parent_id: string | null;
  icon: string | null;
  sort: number;
}

export interface Product {
  id: string;
  sku: string;
  slug: string;
  name_en: string;
  name_zh: string;
  description_en: string | null;
  description_zh: string | null;
  category_id: string | null;
  brand_id: string | null;
  supplier_id: string | null;
  list_price: number;
  moq: number;
  stock_status: StockStatus;
  lead_time_days: number | null;
  unit: string;
  images: string[];
  specs: Record<string, string>;
  hdml_sku: string | null;
  source: string;
  active: boolean;
  featured: boolean;
  needs_review: boolean;
  review_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PriceBreak {
  id: string;
  product_id: string;
  min_qty: number;
  unit_price: number;
}

export interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  buyer_account_id: string | null;
  merchant_account_id: string | null;
  on_behalf: boolean;
  external_source: string | null;
  external_ref: string | null;
  items_digest: string | null;
  claim_token: string | null;
  claim_expires_at: string | null;
  claimed_at: string | null;
  claim_reminders_sent: number;
  currency: string;
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  total: number;
  amount_paid: number;
  /** Generated column: total - amount_paid. */
  amount_due: number;
  payment_status: PaymentStatus;
  payment_provider: string | null;
  payment_ref: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  recipient_country: string | null;
  recipient_city: string | null;
  recipient_address1: string | null;
  recipient_address2: string | null;
  recipient_postal_code: string | null;
  recipient_tax_id: string | null;
  recipient_notes: string | null;
  incoterm: string | null;
  shipping_method: string | null;
  tracking_carrier: string | null;
  tracking_number: string | null;
  buyer_note: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name_snapshot: string;
  sku_snapshot: string | null;
  external_sku: string | null;
  unit_price: number;
  qty: number;
  amount: number;
  is_custom: boolean;
  sort: number;
}

export interface WalletTransaction {
  id: string;
  account_id: string;
  kind: WalletTxnKind;
  amount: number;
  balance_after: number;
  order_id: string | null;
  payment_ref: string | null;
  note: string | null;
  idempotency_key: string | null;
  created_at: string;
}

export interface ApiKey {
  id: string;
  account_id: string;
  key_id: string;
  secret_preview: string;
  name: string;
  scopes: ApiScope[];
  last_used_at: string | null;
  active: boolean;
  created_at: string;
  revoked_at: string | null;
}

export interface WebhookEndpoint {
  id: string;
  account_id: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  created_at: string;
}

export interface Rfq {
  id: string;
  reference: string;
  account_id: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  company_name: string | null;
  destination_country: string | null;
  incoterm: string | null;
  target_price: number | null;
  message: string | null;
  status: RfqStatus;
  quoted_total: number | null;
  quoted_at: string | null;
  created_at: string;
}
