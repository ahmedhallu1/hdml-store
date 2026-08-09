import { requireAdmin } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/settings";
import type { PaymentMethod, ReopenNotification } from "@/lib/db-types";
import { Badge } from "@/components/ui/badge";
import { TextAreaField, TextField } from "@/components/ui/field";
import { ActionForm } from "@/components/admin/action-form";
import { PaymentMethodsManager } from "@/components/admin/payment-methods-manager";
import { fmtDateTime } from "@/components/admin/format";
import { Card, PageHeader } from "@/components/admin/ui";
import {
  setOrderingPausedAction,
  updateContactSettingsAction,
  updateDeliverySettingsAction,
  updateOrderingSettingsAction,
  updateSellerInfoAction,
} from "@/server/actions/admin/settings";

export const metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const service = supabaseService();

  const [settings, methodsRes, waitingRes] = await Promise.all([
    getSiteSettings(),
    service.from("payment_methods").select("*").order("sort").order("created_at"),
    service
      .from("reopen_notifications")
      .select("*", { count: "exact" })
      .is("notified_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const methods = (methodsRes.data ?? []) as PaymentMethod[];
  const waiting = (waitingRes.data ?? []) as ReopenNotification[];
  const waitingCount = waitingRes.count ?? waiting.length;
  const accepting = settings.ordering.accepting_orders;

  return (
    <div className="rise-in">
      <PageHeader
        title="Settings"
        description="Seller identity, delivery copy, ordering rules, contact details and payment methods."
        actions={
          <Badge tone={accepting ? "green" : "red"}>
            {accepting ? "Ordering open" : "Ordering stopped"}
          </Badge>
        }
      />

      {/* Master switch — deliberately first on the page. */}
      <Card
        title="Accept new orders"
        className={`mb-4 ${accepting ? "" : "border-red-300 bg-red-50/40"}`}
      >
        <p className="text-sm text-gray-600">
          Turn this off to stop taking orders without taking the shop down. The catalog, product
          pages and carts keep working; checkout shows{" "}
          <strong>&ldquo;Ordering is stopped right now&rdquo;</strong> with a button for customers to
          be notified when you reopen.
        </p>
        <ActionForm
          action={setOrderingPausedAction}
          submitLabel="Save ordering switch"
          confirmMessage="Change whether the store is accepting orders?"
          className="mt-4 space-y-3"
        >
          <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
            <input
              type="checkbox"
              name="acceptingOrders"
              defaultChecked={accepting}
              className="size-4 accent-brand-700"
            />
            <span className="text-sm font-medium text-gray-900">
              Accept new orders (uncheck to stop ordering for everyone)
            </span>
          </label>
          <TextAreaField
            label="Message shown while ordering is stopped"
            name="pausedNote"
            maxLength={500}
            className="min-h-16"
            defaultValue={settings.ordering.paused_note}
          />
        </ActionForm>

        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="text-sm font-medium text-gray-900">
            Waiting list{" "}
            <span className="font-normal text-gray-500">
              ({waitingCount.toLocaleString("en-US")} waiting to be told you reopened)
            </span>
          </p>
          {waiting.length === 0 ? (
            <p className="mt-1 text-xs text-gray-400">Nobody on the list yet.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs text-gray-600">
              {waiting.map((w) => (
                <li key={w.id} className="flex justify-between gap-3">
                  <span className="truncate">{w.email}</span>
                  <span className="shrink-0 text-gray-400">{fmtDateTime(w.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

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
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Email"
                name="email"
                type="email"
                maxLength={254}
                defaultValue={settings.contact.email}
              />
              <TextField
                label="Telegram"
                name="telegram"
                maxLength={120}
                defaultValue={settings.contact.telegram}
                hint="Handle or link — used by the red “contact us before paying” warning."
              />
            </div>
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
