"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextAreaField } from "@/components/ui/field";
import { ActionForm } from "@/components/admin/action-form";
import { reviewProofAction } from "@/server/actions/admin/orders";

/** "Reject" with a required-reason dialog (reason is emailed to the customer). */
export function ProofRejectButton({ proofId }: { proofId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        Reject
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Reject payment proof">
        <ActionForm
          action={reviewProofAction}
          submitLabel="Reject proof"
          submitVariant="danger"
          className="space-y-3"
        >
          <input type="hidden" name="proofId" value={proofId} />
          <input type="hidden" name="decision" value="rejected" />
          <TextAreaField
            label="Reason"
            name="reason"
            required
            maxLength={500}
            hint="Included in the rejection email — tell the customer what to fix (amount, date, reference…)."
          />
          <p className="text-xs text-gray-500">
            The order returns to Awaiting Payment and the customer is asked to upload a new proof.
          </p>
        </ActionForm>
      </Dialog>
    </>
  );
}
