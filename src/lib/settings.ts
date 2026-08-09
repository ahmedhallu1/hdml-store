import "server-only";
import { supabaseService } from "@/lib/supabase/server";
import type {
  BrandingSettings,
  ContactSettings,
  DeliverySettings,
  OrderingSettings,
  SellerInfo,
} from "@/lib/db-types";

export interface SiteSettings {
  seller_info: SellerInfo;
  delivery: DeliverySettings;
  ordering: OrderingSettings;
  contact: ContactSettings;
  branding: BrandingSettings;
}

const DEFAULTS: SiteSettings = {
  seller_info: {
    name: "Ahmed Tarek Hallul",
    tax_id: "777796066",
    address: "Egypt, Damanhour, Esmail Elhaddad St, 22512",
  },
  delivery: {
    message:
      "Thank you for ordering from us. After your payment is confirmed, a courier service handles delivery and will contact you with the next steps.",
    regions: "All Egypt",
    time: "15 to 30 days",
    fee_note: "No shipping fee is charged on this site — the courier arranges delivery with you. Prices do not include customs clearance or import duties.",
  },
  ordering: {
    min_order_egp: 1000,
    currency: "EGP",
    vat_note: "Prices are final (VAT inclusive).",
    accepting_orders: true,
    paused_note:
      "We have temporarily stopped taking new orders. Leave your email and we will let you know the moment ordering reopens.",
  },
  contact: { phone: "01099019374", whatsapp: "01099019374", email: "elsherka53@gmail.com", telegram: "ahmedhallul", facebook: "", instagram: "" },
  branding: { store_name: "HDML", tagline: "Wholesale Electronics & Accessories", primary_color: "#004754" },
};

/** Fetch all settings, merged over safe defaults so missing keys never crash. */
export async function getSiteSettings(): Promise<SiteSettings> {
  const service = supabaseService();
  const { data, error } = await service.from("site_settings").select("key, value");
  if (error) {
    console.error("site_settings fetch failed:", error.message);
    return DEFAULTS;
  }
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return {
    seller_info: { ...DEFAULTS.seller_info, ...(map.seller_info ?? {}) },
    delivery: { ...DEFAULTS.delivery, ...(map.delivery ?? {}) },
    ordering: { ...DEFAULTS.ordering, ...(map.ordering ?? {}) },
    contact: { ...DEFAULTS.contact, ...(map.contact ?? {}) },
    branding: { ...DEFAULTS.branding, ...(map.branding ?? {}) },
  };
}

/**
 * Telegram handle -> https://t.me/... link. Accepts "@name", "name" or a full
 * URL; returns null when nothing usable is configured.
 */
export function telegramUrl(handle: string | null | undefined): string | null {
  const raw = (handle ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const name = raw.replace(/^@/, "").replace(/^(?:t\.me|telegram\.me)\//i, "");
  return /^[A-Za-z0-9_]{3,64}$/.test(name) ? `https://t.me/${name}` : null;
}

export async function updateSetting(key: keyof SiteSettings, value: unknown): Promise<void> {
  const service = supabaseService();
  const { error } = await service
    .from("site_settings")
    .upsert({ key, value: value as never }, { onConflict: "key" });
  if (error) throw new Error(`Failed to update setting ${key}: ${error.message}`);
}
