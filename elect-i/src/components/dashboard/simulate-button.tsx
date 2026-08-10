"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { simulatePaymentAction } from "@/server/actions/payments";
import type { Locale } from "@/i18n/config";
import { Button } from "@/components/ui/button";

/** Mock-only: mark a pending payment as settled to exercise the money flow. */
export function SimulateButton({
  paymentId,
  lang,
  label,
}: {
  paymentId: string;
  lang: Locale;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await simulatePaymentAction(lang, paymentId);
          router.refresh();
        })
      }
    >
      {label}
    </Button>
  );
}
