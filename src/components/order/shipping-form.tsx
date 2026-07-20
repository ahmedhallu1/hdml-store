"use client";

/**
 * Post-payment "confirm your order + shipping details" form on the order
 * tracking page. Submits through submitShipping (the tracking token is the
 * credential). On success the page refreshes to show the confirmed details.
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GOVERNORATES } from "@/lib/egypt";
import { submitShipping } from "@/server/actions/shipping";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { TurnstileWidget, type TurnstileHandle } from "@/components/turnstile-widget";

export interface ShippingDefaults {
  phone: string;
  governorate: string;
  address: string;
  companyName: string;
  taxId: string;
}

export function ShippingForm({
  token,
  defaults,
  submitLabel = "Confirm order & shipping details",
}: {
  token: string;
  defaults?: ShippingDefaults;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileHandle>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const payload = {
      token,
      phone: String(form.get("phone") ?? ""),
      governorate: String(form.get("governorate") ?? ""),
      address: String(form.get("address") ?? ""),
      companyName: String(form.get("companyName") ?? ""),
      taxId: String(form.get("taxId") ?? ""),
      turnstileToken,
    };

    startTransition(async () => {
      const result = await submitShipping(payload);
      if (result.ok) {
        router.refresh();
        return;
      }
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      setTurnstileToken("");
      turnstileRef.current?.reset();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2" noValidate>
      <TextField
        label="Mobile number"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="01012345678"
        required
        defaultValue={defaults?.phone}
        error={fieldErrors.phone}
      />
      <SelectField
        label="Governorate"
        name="governorate"
        required
        defaultValue={defaults?.governorate ?? ""}
        error={fieldErrors.governorate}
      >
        <option value="" disabled>
          Select…
        </option>
        {GOVERNORATES.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </SelectField>
      <div className="sm:col-span-2">
        <TextAreaField
          label="Delivery address"
          name="address"
          autoComplete="street-address"
          required
          defaultValue={defaults?.address}
          hint="Street, building, floor — anything the courier needs."
          error={fieldErrors.address}
        />
      </div>
      <TextField
        label="Company name"
        name="companyName"
        autoComplete="organization"
        defaultValue={defaults?.companyName}
        hint="Optional."
        error={fieldErrors.companyName}
      />
      <TextField
        label="Tax ID"
        name="taxId"
        defaultValue={defaults?.taxId}
        hint="Optional."
        error={fieldErrors.taxId}
      />
      <div className="sm:col-span-2">
        <TurnstileWidget ref={turnstileRef} onToken={(t) => setTurnstileToken(t ?? "")} />
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200 sm:col-span-2"
        >
          {error}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" disabled={pending || !turnstileToken}>
          {pending && <Spinner className="size-4 border-white/40 border-t-white" />}
          {pending ? "Saving…" : submitLabel}
        </Button>
        {!turnstileToken && !pending && (
          <p className="mt-2 text-xs text-gray-400">Waiting for human verification…</p>
        )}
      </div>
    </form>
  );
}
