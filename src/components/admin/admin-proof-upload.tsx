"use client";

/**
 * Owner-side proof attachment.
 *
 * Buyers often send the transfer screenshot over WhatsApp/Telegram rather than
 * uploading it, so the owner needs a way to file it against the order. Posts
 * multipart to /api/admin/orders/[id]/proof; the order status is deliberately
 * left alone (change it from the Status panel).
 */

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type Decision = "approved" | "pending" | "rejected";

export function AdminProofUpload({ orderId }: { orderId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setMessage({ ok: false, text: "Choose an image first." });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/proof`, {
        method: "POST",
        body: data,
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMessage({ ok: false, text: body.error ?? "Upload failed. Please try again." });
      } else {
        setMessage({ ok: true, text: "Proof attached to this order." });
        formRef.current?.reset();
        router.refresh();
      }
    } catch {
      setMessage({ ok: false, text: "Upload failed. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label
          htmlFor="admin-proof-file"
          className="mb-1 block text-xs font-medium text-gray-600"
        >
          Screenshot (JPG, PNG or WebP · max 4 MB)
        </label>
        <input
          id="admin-proof-file"
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-sm text-gray-700 file:mr-3 file:h-9 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:text-sm file:font-medium file:text-brand-800 hover:file:bg-brand-100"
        />
      </div>
      <div>
        <label htmlFor="admin-proof-status" className="mb-1 block text-xs font-medium text-gray-600">
          File it as
        </label>
        <select
          id="admin-proof-status"
          name="status"
          defaultValue={"approved" satisfies Decision}
          className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none"
        >
          <option value="approved">Approved — I have verified this transfer</option>
          <option value="pending">Pending — still to review</option>
          <option value="rejected">Rejected — kept for the record</option>
        </select>
      </div>
      <div>
        <label htmlFor="admin-proof-note" className="mb-1 block text-xs font-medium text-gray-600">
          Note (optional)
        </label>
        <input
          id="admin-proof-note"
          name="note"
          maxLength={500}
          placeholder="Sent by the customer on WhatsApp"
          className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none"
        />
      </div>

      <Button type="submit" size="sm" disabled={busy}>
        {busy && <Spinner className="size-3.5 border-white/40 border-t-white" />}
        {busy ? "Uploading…" : "Attach proof"}
      </Button>

      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`text-xs ${message.ok ? "text-emerald-700" : "text-red-600"}`}
        >
          {message.text}
        </p>
      )}
      <p className="text-xs text-gray-400">
        Attaching a proof does not change the order status — use the Status panel for that.
      </p>
    </form>
  );
}
