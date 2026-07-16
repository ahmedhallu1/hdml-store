"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PaymentMethod } from "@/lib/db-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import {
  clearPaymentMethodQrAction,
  savePaymentMethodAction,
  togglePaymentMethodAction,
} from "@/server/actions/admin/settings";

function siteAssetUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site-assets/${path}`;
}

interface EditState {
  methodId?: string;
  kind: "instapay" | "wallet";
  label: string;
  number: string;
  displayName: string;
  instructions: string;
  active: boolean;
  sort: string;
}

const EMPTY: EditState = {
  kind: "wallet",
  label: "",
  number: "",
  displayName: "",
  instructions: "",
  active: true,
  sort: "0",
};

export function PaymentMethodsManager({ methods }: { methods: PaymentMethod[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<EditState | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  function openEdit(m: PaymentMethod) {
    setDialogError(null);
    setFieldErrors({});
    setEditing({
      methodId: m.id,
      kind: m.kind,
      label: m.label,
      number: m.number,
      displayName: m.display_name ?? "",
      instructions: m.instructions ?? "",
      active: m.active,
      sort: String(m.sort),
    });
  }

  function save() {
    if (!editing) return;
    startTransition(async () => {
      const result = await savePaymentMethodAction({
        methodId: editing.methodId,
        kind: editing.kind,
        label: editing.label.trim(),
        number: editing.number.trim(),
        displayName: editing.displayName.trim(),
        instructions: editing.instructions.trim(),
        active: editing.active,
        sort: Number.parseInt(editing.sort, 10) || 0,
      });
      if (result.ok) {
        setEditing(null);
        setMessage(result.message ?? "Saved.");
      } else {
        setDialogError(result.message ?? "Save failed");
        setFieldErrors(result.errors ?? {});
      }
    });
  }

  function toggle(m: PaymentMethod) {
    setBusyId(m.id);
    startTransition(async () => {
      const result = await togglePaymentMethodAction({ methodId: m.id, active: !m.active });
      setMessage(result.message ?? null);
      setBusyId(null);
    });
  }

  function clearQr(m: PaymentMethod) {
    if (!window.confirm(`Remove the QR image for "${m.label}"?`)) return;
    setBusyId(m.id);
    startTransition(async () => {
      const result = await clearPaymentMethodQrAction({ methodId: m.id });
      setMessage(result.message ?? null);
      setBusyId(null);
    });
  }

  async function uploadQr(m: PaymentMethod, file: File) {
    setBusyId(m.id);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("methodId", m.id);
      const res = await fetch("/api/admin/upload-qr", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
      if (!res.ok || !json.path) throw new Error(json.error ?? `Upload failed (${res.status})`);
      setMessage("QR image uploaded.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-400">
          When a method has no QR image, checkout and tracking pages auto-generate a QR from its
          number.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setDialogError(null);
            setFieldErrors({});
            setEditing({ ...EMPTY });
          }}
        >
          Add method
        </Button>
      </div>

      {message && (
        <p role="status" className="mb-3 text-xs text-brand-700">
          {message}
        </p>
      )}

      <ul className="space-y-3">
        {methods.map((m) => (
          <li
            key={m.id}
            className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center"
          >
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              {m.qr_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={siteAssetUrl(m.qr_path)}
                  alt={`QR for ${m.label}`}
                  className="size-full object-contain"
                />
              ) : (
                <span className="text-[10px] text-gray-400">auto QR</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{m.label}</span>
                <Badge tone={m.kind === "instapay" ? "brand" : "blue"}>{m.kind}</Badge>
                <Badge tone={m.active ? "green" : "gray"}>{m.active ? "active" : "inactive"}</Badge>
                <span className="text-xs text-gray-400">sort {m.sort}</span>
              </div>
              <p className="mt-0.5 text-sm text-gray-600">
                <span className="font-mono">{m.number}</span>
                {m.display_name && <span className="text-gray-400"> · {m.display_name}</span>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => openEdit(m)}>
                Edit
              </Button>
              <Button
                variant={m.active ? "ghost" : "secondary"}
                size="sm"
                disabled={pending && busyId === m.id}
                onClick={() => toggle(m)}
              >
                {m.active ? "Deactivate" : "Activate"}
              </Button>
              <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-brand-200 px-3 text-sm font-medium text-brand-800 hover:bg-brand-50">
                {busyId === m.id ? <Spinner className="mr-1.5 size-3.5" /> : null}
                {m.qr_path ? "Replace QR" : "Upload QR"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadQr(m, f);
                    e.target.value = "";
                  }}
                />
              </label>
              {m.qr_path && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => clearQr(m)}
                >
                  Clear QR
                </Button>
              )}
            </div>
          </li>
        ))}
        {methods.length === 0 && (
          <li className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
            No payment methods yet — add Instapay or wallet numbers.
          </li>
        )}
      </ul>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.methodId ? "Edit payment method" : "Add payment method"}
      >
        {editing && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <SelectField
              label="Kind"
              value={editing.kind}
              onChange={(e) =>
                setEditing({ ...editing, kind: e.target.value as "instapay" | "wallet" })
              }
            >
              <option value="instapay">Instapay</option>
              <option value="wallet">Mobile wallet</option>
            </SelectField>
            <TextField
              label="Label"
              required
              minLength={2}
              maxLength={80}
              value={editing.label}
              onChange={(e) => setEditing({ ...editing, label: e.target.value })}
              placeholder="Instapay"
              error={fieldErrors.label}
            />
            <TextField
              label="Number / address"
              required
              minLength={5}
              maxLength={40}
              value={editing.number}
              onChange={(e) => setEditing({ ...editing, number: e.target.value })}
              placeholder="01099019374"
              error={fieldErrors.number}
            />
            <TextField
              label="Display name (optional)"
              maxLength={120}
              value={editing.displayName}
              onChange={(e) => setEditing({ ...editing, displayName: e.target.value })}
              placeholder="Ahmed T**** F*****"
              error={fieldErrors.displayName}
            />
            <TextAreaField
              label="Instructions (optional)"
              maxLength={1000}
              className="min-h-16"
              value={editing.instructions}
              onChange={(e) => setEditing({ ...editing, instructions: e.target.value })}
              error={fieldErrors.instructions}
            />
            <div className="flex items-end gap-3">
              <div className="w-24">
                <TextField
                  label="Sort"
                  type="number"
                  min={0}
                  max={1000}
                  value={editing.sort}
                  onChange={(e) => setEditing({ ...editing, sort: e.target.value })}
                  error={fieldErrors.sort}
                />
              </div>
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  className="size-4 accent-brand-700"
                />
                Active
              </label>
            </div>
            {dialogError && (
              <p role="alert" className="text-sm text-red-600">
                {dialogError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending && <Spinner className="size-3.5 border-white/40 border-t-white" />}
                Save
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
