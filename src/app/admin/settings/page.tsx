import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/settings";
import type { PaymentMethod } from "@/lib/db-types";
import { TextAreaField, TextField } from "@/components/ui/field";
import { ActionForm } from "@/components/admin/action-form";
import { PaymentMethodsManager } from "@/components/admin/payment-methods-manager";
import { Card, PageHeader } from "@/components/admin/ui";
import {
  updateContactSettingsAction,
  updateDeliverySettingsAction,
  updateOrderingSettingsAction,
  updateSellerInfoAction,
} from "@/server/actions/admin/settings";

export const metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const service = supabaseService();

  const [settings, methodsRes] = await Promise.all([
    getSiteSettings(),
    service.from("payment_methods").select("*").order("sort").order("created_at"),
  ]);
  const methods = (methodsRes.data ?? []) as PaymentMethod[];

  return (
    <div className="rise-in">
      <PageHeader
        title="Settings"
        description="Seller identity, delivery copy, ordering rules, contact details and payment methods."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Seller info (appears on receipts)">
          <ActionForm action={updateSellerInfoAction} submitLabel="Save seller info" className="space-y-3">
            <TextField
              label="Seller name"
              name="name"
              required
              minLength={2}
              maxLength={160}
              defaultValue={settings.seller_info.name}
            />
            <TextField
              label="Tax ID"
              name="taxId"
              maxLength={40}
              defaultValue={settings.seller_info.tax_id}
            />
            <TextAreaField
              label="Address"
              name="address"
              maxLength={300}
              className="min-h-16"
              defaultValue={settings.seller_info.address}
            />
          </ActionForm>
        </Card>

        <Card title="Delivery">
          <ActionForm action={updateDeliverySettingsAction} submitLabel="Save delivery" className="space-y-3">
            <TextAreaField
              label="Delivery message (emails + receipts)"
              name="message"
              required
              maxLength={500}
              className="min-h-16"
              defaultValue={settings.delivery.message}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Regions"
                name="regions"
                maxLength={200}
                defaultValue={settings.delivery.regions}
              />
              <TextField
                label="Delivery time"
                name="time"
                maxLength={100}
                defaultValue={settings.delivery.time}
              />
            </div>
            <TextAreaField
              label="Fee note"
              name="feeNote"
              maxLength={300}
              className="min-h-16"
              defaultValue={settings.delivery.fee_note}
            />
          </ActionForm>
        </Card>

        <Card title="Ordering">
          <ActionForm action={updateOrderingSettingsAction} submitLabel="Save ordering" className="space-y-3">
            <TextField
              label="Minimum order (EGP)"
              name="minOrderEgp"
              type="number"
              min={0}
              max={10000000}
              required
              defaultValue={settings.ordering.min_order_egp}
              hint="Checkout blocks orders below this total (whole pounds)."
            />
            <TextField
              label="VAT note"
              name="vatNote"
              maxLength={300}
              defaultValue={settings.ordering.vat_note}
            />
            <TextField
              label="External order platform link"
              name="externalOrderUrl"
              type="url"
              maxLength={500}
              placeholder="https://…"
              defaultValue={settings.ordering.external_order_url}
              hint="After you verify a payment, the customer is emailed this link to confirm the order and enter shipping details. Leave empty until it's ready."
            />
          </ActionForm>
        </Card>

        <Card title="Contact">
          <ActionForm action={updateContactSettingsAction} submitLabel="Save contact" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Phone"
                name="phone"
                maxLength={40}
                defaultValue={settings.contact.phone}
              />
              <TextField
                label="WhatsApp"
                name="whatsapp"
                maxLength={40}
                defaultValue={settings.contact.whatsapp}
              />
            </div>
            <TextField
              label="Email"
              name="email"
              type="email"
              maxLength={254}
              defaultValue={settings.contact.email}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Facebook URL"
                name="facebook"
                maxLength={300}
                defaultValue={settings.contact.facebook}
              />
              <TextField
                label="Instagram URL"
                name="instagram"
                maxLength={300}
                defaultValue={settings.contact.instagram}
              />
            </div>
          </ActionForm>
        </Card>
      </div>

      <Card title="Payment methods" className="mt-4">
        <PaymentMethodsManager methods={methods} />
      </Card>
    </div>
  );
}
