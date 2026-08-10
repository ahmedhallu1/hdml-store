"use client";

import { useActionState, useState } from "react";
import { updateBrandingAction, type DashboardState } from "@/server/actions/dashboard";
import type { Locale } from "@/i18n/config";
import { TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export function BrandingForm({
  lang,
  displayName,
  logoUrl,
  dict,
}: {
  lang: Locale;
  displayName: string;
  logoUrl: string;
  dict: {
    displayName: string;
    displayNameHint: string;
    logoUrl: string;
    logoUrlHint: string;
    logoPreview: string;
    save: string;
    saving: string;
    saved: string;
    optional: string;
  };
}) {
  const [state, action, pending] = useActionState<DashboardState, FormData>(
    updateBrandingAction.bind(null, lang),
    {},
  );
  const [preview, setPreview] = useState(logoUrl);
  const errors = state.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4">
      {errors._form ? (
        <p role="alert" className="rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-sm text-danger-400">
          {errors._form}
        </p>
      ) : null}
      {state.ok ? (
        <p className="flex items-center gap-2 rounded-lg border border-settled-500/30 bg-settled-500/10 px-3 py-2 text-sm text-settled-400">
          <Icon name="check" className="size-4" />
          {dict.saved}
        </p>
      ) : null}

      <TextField
        id="displayName"
        name="displayName"
        label={dict.displayName}
        hint={dict.displayNameHint}
        defaultValue={displayName}
        error={errors.displayName}
        optionalLabel={dict.optional}
      />

      <TextField
        id="logoUrl"
        name="logoUrl"
        type="url"
        label={dict.logoUrl}
        hint={dict.logoUrlHint}
        defaultValue={logoUrl}
        error={errors.logoUrl}
        onChange={(e) => setPreview(e.target.value)}
        optionalLabel={dict.optional}
      />

      {preview ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
            {dict.logoPreview}
          </p>
          <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.03] p-3">
            {/* Merchant-supplied URL, so a plain img with a graceful failure —
                not next/image, which would need the host allow-listed. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt=""
              className="max-h-12 max-w-[12rem] object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        </div>
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? dict.saving : dict.save}
      </Button>
    </form>
  );
}
