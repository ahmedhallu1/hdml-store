"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { deleteProductAction } from "@/server/actions/admin/products";

/**
 * Danger-zone delete: hard delete when the product was never ordered,
 * otherwise the server deactivates it and explains why.
 */
export function DeleteProductButton({ productId, name }: { productId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run() {
    startTransition(async () => {
      const result = await deleteProductAction({ productId });
      setMessage(result.message ?? null);
      if (result.ok && result.deleted) {
        router.push("/admin/products");
      }
    });
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        Delete product
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Delete product">
        <p className="text-sm text-gray-600">
          Delete <span className="font-medium text-gray-900">{name}</span>? If any order references
          it, it will be <span className="font-medium">deactivated instead</span> so order history
          stays intact. This cannot be undone.
        </p>
        {message && (
          <p role="alert" className="mt-3 text-sm text-amber-700">
            {message}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={run} disabled={pending}>
            {pending && <Spinner className="size-3.5 border-white/40 border-t-white" />}
            Confirm delete
          </Button>
        </div>
      </Dialog>
    </>
  );
}
